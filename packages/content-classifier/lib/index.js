'use strict'

const path = require('path')
const _ = require('lodash')

const $files = Symbol('files')
const $generateId = Symbol('generateId')

class ContentCatalog {
  constructor () {
    this[$files] = {}
  }

  getFiles () {
    return Object.values(this[$files])
  }

  addFile (file) {
    const id = this[$generateId](_.pick(file.src, 'component', 'version', 'module', 'family', 'relative'))
    if (id in this[$files]) {
      throw new Error('Duplicate file')
    }
    this[$files][id] = file
  }

  findBy (options) {
    const srcFilter = _.pick(options, ['component', 'version', 'module', 'family', 'relative', 'basename', 'extname'])
    return _.filter(this[$files], { src: srcFilter })
  }

  getById ({ component, version, module, family, relative }) {
    const id = this[$generateId]({ component, version, module, family, relative })
    return this[$files][id]
  }

  getByPath ({ component, version, path: path_ }) {
    return _.find(this[$files], { path: path_, src: { component, version } })
  }

  [$generateId] ({ component, version, module, family, relative }) {
    return `${family}/${version}@${component}:${module}:${relative}`
  }
}

module.exports = (playbook, aggregate) => {
  const siteUrl = playbook.site.url.endsWith('/') ? playbook.site.url.slice(0, -1) : playbook.site.url
  return aggregate.reduce((catalog, { name: component, version, nav, files }) => {
    files.forEach((file) => {
      const family = partitionSrc(file, component, version, nav)

      if (!family) {
        return
      } else if (family === 'page' || family === 'image' || family === 'attachment' || family === 'navigation') {
        if (family !== 'navigation') file.out = resolveOut(file.src, playbook.urls.htmlExtensionStyle)
        file.pub = resolvePub(file.src, file.out, playbook.urls.htmlExtensionStyle, siteUrl)
      }

      catalog.addFile(file)
    })
    return catalog
  }, new ContentCatalog())
}

function partitionSrc (file, component, version, nav) {
  const filepath = file.path
  const pathSegments = filepath.split('/')
  const navInfo = nav ? getNavInfo(filepath, nav) : undefined
  if (navInfo) {
    file.nav = navInfo
    file.src.family = 'navigation'
    if (pathSegments[0] === 'modules' && pathSegments.length > 2) {
      file.src.module = pathSegments[1]
      // relative to modules/<module>
      file.src.relative = pathSegments.slice(2).join('/')
      file.src.moduleRootPath = calculateRootPath(pathSegments.length - 3)
    } else {
      // relative to root
      file.src.relative = filepath
    }
  } else if (pathSegments[0] === 'modules') {
    if (pathSegments[2] === 'pages') {
      if (pathSegments[3] === '_partials') {
        // QUESTION should this family be partial-page instead?
        file.src.family = 'partial'
        // relative to modules/<module>/pages/_partials
        file.src.relative = pathSegments.slice(4).join('/')
      } else if (file.src.mediaType === 'text/asciidoc' && file.src.basename !== '_attributes.adoc') {
        file.src.family = 'page'
        // relative to modules/<module>/pages
        file.src.relative = pathSegments.slice(3).join('/')
      }
    } else if (pathSegments[2] === 'assets') {
      if (pathSegments[3] === 'images') {
        file.src.family = 'image'
        // relative to modules/<module>/assets/images
        file.src.relative = pathSegments.slice(4).join('/')
      } else if (pathSegments[3] === 'attachments') {
        file.src.family = 'attachment'
        // relative to modules/<module>/assets/attachments
        file.src.relative = pathSegments.slice(4).join('/')
      }
    } else if (pathSegments[2] === 'examples') {
      file.src.family = 'example'
      // relative to modules/<module>/examples
      file.src.relative = pathSegments.slice(3).join('/')
    } else {
      return
    }

    file.src.module = pathSegments[1]
    file.src.moduleRootPath = calculateRootPath(pathSegments.length - 3)
  } else {
    return
  }

  file.src.component = component
  file.src.version = version
  return file.src.family
}

/**
 * Return navigation properties if this file is registered as a navigation file.
 *
 * @param {String} filepath - the path of the virtual file to match.
 * @param {Array} nav - the array of navigation entries from the component descriptor.
 *
 * @returns {Object} An object of properties, which includes the navigation
 * index, if this file is a navigation file, or undefined if it's not.
 */
function getNavInfo (filepath, nav) {
  const index = nav.findIndex((candidate) => candidate === filepath)
  if (index !== -1) return { index }
}

function resolveOut (src, htmlExtensionStyle = 'default') {
  const version = src.version === 'master' ? '' : src.version
  const module = src.module === 'ROOT' ? '' : src.module

  let basename = src.basename
  if (src.mediaType === 'text/asciidoc') basename = src.stem + '.html'

  let indexifyPathSegment = ''
  if (src.family === 'page' && src.stem !== 'index' && htmlExtensionStyle === 'indexify') {
    basename = 'index.html'
    indexifyPathSegment = src.stem
  }

  let familyPathSegment = ''
  if (src.family === 'image') {
    familyPathSegment = '_images'
  } else if (src.family === 'attachment') {
    familyPathSegment = '_attachments'
  }

  const modulePath = path.join(src.component, version, module)
  const dirname = path.join(modulePath, familyPathSegment, path.dirname(src.relative), indexifyPathSegment)
  const path_ = path.join(dirname, basename)
  const moduleRootPath = path.relative(dirname, modulePath) || '.'
  const rootPath = path.relative(dirname, '') || '.'

  return {
    dirname,
    basename,
    path: path_,
    moduleRootPath,
    rootPath,
  }
}

function resolvePub (src, out, htmlExtensionStyle, siteUrl) {
  const pub = {}
  const family = src.family
  let url
  if (family === 'navigation') {
    const urlSegments = [src.component]
    if (src.version !== 'master') urlSegments.push(src.version)
    if (src.module && src.module !== 'ROOT') urlSegments.push(src.module)
    // an artificial URL used for resolving page references in navigation model
    url = '/' + urlSegments.join('/') + '/'
    pub.moduleRootPath = '.'
  } else if (family === 'page') {
    const urlSegments = out.path.split('/')
    const lastUrlSegmentIdx = urlSegments.length - 1
    if (htmlExtensionStyle === 'drop') {
      // drop just the .html extension or, if the filename is index.html, the whole segment
      if ((urlSegments[lastUrlSegmentIdx] = urlSegments[lastUrlSegmentIdx].slice(0, -5)) === 'index') {
        urlSegments[lastUrlSegmentIdx] = ''
      }
    } else if (htmlExtensionStyle === 'indexify') {
      urlSegments[lastUrlSegmentIdx] = ''
    }
    url = '/' + urlSegments.join('/')
  } else {
    url = '/' + out.path
  }

  pub.url = url
  pub.absoluteUrl = siteUrl + url

  if (out) {
    pub.moduleRootPath = out.moduleRootPath
    pub.rootPath = out.rootPath
  }

  return pub
}

function calculateRootPath (depth) {
  return depth
    ? Array(depth)
      .fill('..')
      .join('/')
    : '.'
}
