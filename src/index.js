import path from 'path'
import fs from 'fs'
import pump from 'pump'

// promisify
const readFile = (file) => new Promise((resolve, reject) => {
  fs.readFile(file, (err, data) => {
    if (err) return reject(err)
    resolve(data)
  })
})
const writeFile = (file, data) => new Promise((resolve, reject) => {
  fs.writeFile(file, data, (err) => {
    if (err) return reject(err)
    resolve(data)
  })
})
const stat = (file) => new Promise((resolve, reject) => {
  fs.stat(file, (err, statObj) => {
    if (err) return reject(err)
    resolve(statObj)
  })
})

export default ({
  directory = '.fs-tus-store',
} = {}) => {
  const absoluteDir = path.resolve(directory)
  // Returns { uploadOffset[, uploadLength] }

  // TODO: convert key to base64 or validate it?
  const keyPath = (key) => path.join(absoluteDir, key)
  const keyInfoPath = (key) => `${keyPath(key)}.info`

  const getKeyInfo = (key) => readFile(keyInfoPath(key))
    .then(data => JSON.parse(data))

  const setKeyInfo = (key, infoObj) => Promise.resolve()
    .then(() => JSON.stringify(infoObj))
    .then(data => writeFile(keyInfoPath(key), data))

  const getKeyOffset = (key) => stat(keyPath(key))
    .then(({ size }) => size)

  const touchKey = (key) => writeFile(keyPath(key), '')

  // TODO: fail if key already exists?
  const create = (key, { uploadLength, uploadMetadata } = {}) => (
    setKeyInfo(key, { uploadLength, uploadMetadata })
      .then(() => touchKey(key))
  )

  const info = key => getKeyInfo(key)
    .then(infoObj => (
      getKeyOffset(key)
        .then((uploadOffset) => ({
          ...infoObj,
          uploadOffset,
        }))
    ))

  const write = (key, rs) => new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(keyPath(key), {
      flags: 'a', // append to file
    })
    pump(rs, ws, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })

  return {
    info,
    create,
    write,
  }
}
