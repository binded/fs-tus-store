import fs from 'fs'
import { PassThrough } from 'stream'
import { errors } from 'abstract-tus-store'
import uuid from 'uuid'
import str from 'string-to-stream'
import fsBlobStore from 'fs-blob-store'
import initDebug from 'debug'
import concat from 'concat-stream'
import MeterStream from 'meterstream'
import { SizeStream } from 'common-streams'
import { join, resolve as resolvePath } from 'path'

const debug = initDebug('fs-tus-store')

// promisify fs...
const symlink = (target, path) => new Promise((resolve, reject) => {
  fs.symlink(target, path, (err) => {
    if (err) return reject(err)
    resolve()
  })
})
const unlink = (path) => new Promise((resolve, reject) => {
  fs.unlink(path, (err) => {
    if (err) return reject(err)
    resolve()
  })
})
const forceSymlink = async (target, path) => {
  try {
    await symlink(target, path)
  } catch (err) {
    if (err.code === 'EEXIST') {
      await unlink(path)
      await symlink(target, path)
    }
  }
}

// TODO: prevent concurrent operations...
export default ({
  directory = '.fs-tus-store',
} = {}) => {
  const absoluteDir = resolvePath(directory)
  const blobStore = fsBlobStore(absoluteDir)

  const keyToPath = (key) => join(absoluteDir, key)
  const uploadIdToKey = (uploadId) => `.uploads/${uploadId}.info`
  const uploadIdToDataKey = (uploadId) => `.uploads/${uploadId}`
  const keyToUploadKey = (key) => `${key}.upload`

  const put = (key, data) => new Promise((resolve, reject) => {
    const ws = blobStore.createWriteStream(key, (err) => {
      if (err) return reject(err)
      resolve()
    })
    str(data).pipe(ws)
  })

  const saveUpload = async (uploadId, upload) => {
    const json = JSON.stringify(upload)
    await put(uploadIdToDataKey(uploadId), '')
    await put(uploadIdToKey(uploadId), json)
  }

  const getUpload = async (uploadId) => {
    const key = uploadIdToKey(uploadId)
    const keyExists = await new Promise((resolve, reject) => {
      blobStore.exists(key, (err, result) => {
        if (err) return reject(err)
        resolve(result)
      })
    })
    if (!keyExists) throw new errors.UploadNotFound(uploadId)
    const json = await new Promise((resolve, reject) => {
      const rs = blobStore
        .createReadStream(key)
        .on('error', reject)
      rs.pipe(concat((result) => {
        resolve(result)
      }))
    })
    return JSON.parse(json)
  }

  const getUploadFromKey = async (key) => {
    const json = await new Promise((resolve, reject) => {
      const uploadKey = keyToUploadKey(key)
      blobStore
        .createReadStream(uploadKey)
        .on('error', reject)
        .pipe(concat((result) => {
          resolve(result)
        }))
    })
    return JSON.parse(json)
  }

  // TODO: fail if key already exists?
  const create = async (key, {
    uploadLength,
    metadata = {},
  } = {}) => {
    const uploadId = uuid.v4()
    const upload = {
      key,
      uploadLength,
      metadata,
    }
    await saveUpload(uploadId, upload)
    return { uploadId }
  }

  const filesize = (path) => new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) return reject(err)
      resolve(stats.size)
    })
  })

  const getUploadOffset = async (uploadId) => {
    const key = uploadIdToDataKey(uploadId)
    return filesize(keyToPath(key))
  }

  const info = async uploadId => {
    const upload = await getUpload(uploadId)
    debug(upload)
    const offset = await getUploadOffset(uploadId)
      .catch(err => {
        // we got the upload file but upload data does not exist
        // that means the upload is actually completed.
        if (err.code === 'ENOENT') {
          return upload.uploadLength
        }
        throw err
      })
    return {
      offset,
      ...upload,
    }
  }

  const createLimitStream = (uploadLength, offset) => {
    if (typeof uploadLength === 'undefined') return new PassThrough()
    const meterStream = new MeterStream(uploadLength - offset)
    return meterStream
  }

  const completeUpload = async (uploadId, upload) => {
    const oldPath = keyToPath(uploadIdToDataKey(uploadId))
    const newPath = keyToPath(upload.key)
    const uploadResourcePath = keyToPath(uploadIdToKey(uploadId))
    await forceSymlink(uploadResourcePath, keyToPath(keyToUploadKey(upload.key)))
    return new Promise((resolve, reject) => {
      fs.rename(oldPath, newPath, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  const append = async (uploadId, rs, arg3, arg4) => {
    // guess arg by type
    const { expectedOffset, opts = {} } = (() => {
      if (typeof arg3 === 'object') {
        return { opts: arg3 }
      }
      return { expectedOffset: arg3, opts: arg4 }
    })()
    // need to do this asap to make sure we don't miss reads
    const through = rs.pipe(new PassThrough())

    debug('append opts', opts)

    const upload = await getUpload(uploadId)
    const offset = await getUploadOffset(uploadId)
    if (Number.isInteger(expectedOffset)) {
      // check if offset is right
      if (offset !== expectedOffset) {
        throw new errors.OffsetMismatch(offset, expectedOffset)
      }
    }
    const limitStream = createLimitStream(upload.uploadLength, offset)
    const bytesWritten = await new Promise((resolve, reject) => {
      let size
      const sizeStream = new SizeStream((s) => { size = s })
      const ws = blobStore.createWriteStream({
        key: uploadIdToDataKey(uploadId),
        flags: 'a',
      }, (err) => {
        if (err) return reject(err)
        resolve(size)
      })
      through.pipe(limitStream).pipe(sizeStream).pipe(ws)
    })
    const newOffset = offset + bytesWritten
    if (newOffset === upload.uploadLength) {
      await completeUpload(uploadId, upload)
      return {
        offset: newOffset,
        complete: true,
        upload: {
          ...upload,
          offset: newOffset,
        },
      }
    }
    return { offset: newOffset }
  }

  const createReadStream = (key, onInfo) => {
    const getInfo = async () => {
      const contentLength = await filesize(keyToPath(key))
      const { metadata } = await getUploadFromKey(key)
      onInfo({ contentLength, metadata })
    }
    if (onInfo) getInfo()
    return blobStore.createReadStream(key)
  }

  return {
    info,
    create,
    append,
    createReadStream,
  }
}
