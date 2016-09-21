# fs-tus-store

[![Build Status](https://travis-ci.org/blockai/fs-tus-store.svg?branch=master)](https://travis-ci.org/blockai/fs-tus-store)

[![tus-store-compatible](https://github.com/blockai/abstract-tus-store/raw/master/badge.png)](https://github.com/blockai/abstract-tus-store)

## Install

```bash
npm install --save fs-tus-store
```

Requires Node v6+

## Usage

```javascript
import fsTusStore from 'fs-tus-store'

const store = fsTusStore({ directory: './data' })
```

See
[abstract-tus-store](https://github.com/blockai/abstract-tus-store#api)
for API documentation.
