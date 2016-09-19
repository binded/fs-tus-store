import test from 'blue-tape'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import str from 'string-to-stream'

import initFsStore from '../src'

const resetStore = () => {
  const directory = `${__dirname}/.data`
  rimraf.sync(directory)
  mkdirp.sync(directory)
  return initFsStore({ directory })
}

const store = resetStore()

test('info - unknown key', (t) => {
  store
    .info('unknown-key')
    .catch((err) => {
      t.ok(err instanceof Error)
      t.end()
    })
})

test('info - foo- unknown key', (t) => {
  store
    .info('foo')
    .catch((err) => {
      t.ok(err instanceof Error)
      t.end()
    })
})

test('create foo', () => (
  store
    .create('foo', { uploadLength: 'bar'.length })
))

test('info foo', (t) => (
  store
    .info('foo')
    .then(({ uploadOffset, uploadLength }) => {
      t.equal(uploadOffset, 0)
      t.equal(uploadLength, 3)
    })
))

test('write ba to foo', () => (
  store
    .write('foo', str('ba'))
))

test('info foo', (t) => (
  store
    .info('foo')
    .then(({ uploadOffset, uploadLength }) => {
      t.equal(uploadOffset, 2)
      t.equal(uploadLength, 3)
    })
))

test('write r to foo', () => store.write('foo', str('r')))

test('info foo', (t) => (
  store
    .info('foo')
    .then(({ uploadOffset, uploadLength }) => {
      t.equal(uploadOffset, 3)
      t.equal(uploadLength, 3)
    })
))
