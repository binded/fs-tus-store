import testStore from 'abstract-tus-store'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import initFsStore from '../src'

const setup = () => {
  const directory = `${__dirname}/.data`
  rimraf.sync(directory)
  mkdirp.sync(directory)
  return initFsStore({ directory })
}

testStore({ setup })
