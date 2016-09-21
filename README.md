# fs-tus-store

[![Build Status](https://travis-ci.org/blockai/fs-tus-store.svg?branch=master)](https://travis-ci.org/blockai/fs-tus-store)

[![tus-store-compatible](https://github.com/blockai/abstract-tus-store/raw/master/badge.png)](https://github.com/blockai/abstract-tus-store)

## Install

```bash
npm install --save fs-tus-store
```

Requires Node v6+

## Usage

See [./test](./test) directory for usage examples.

All methods return promises.

### Creating client

```javascript
import initFsStore from 'tus-fs-store'
const store  = initFsStore({ directory: './path/to/base/directory' })
```

### info(key)

Resolves to an `{ uploadOffset[, uploadLength, uploadMetadata] }` object.

### create(key[, { uploadLength, uploadMetadata }])

### write(key, readStream)
