/* eslint-env mocha */
'use strict'

const { expect, mockContentCatalog } = require('@antora/test-harness')

const produceRedirects = require('@antora/redirect-producer')

describe('produceRedirects()', () => {
  let contentCatalog
  let playbook

  const extractRules = ({ contents }) => contents.toString().trimRight().split('\n').sort()

  beforeEach(() => {
    playbook = {
      site: { url: 'https://docs.example.org' },
      urls: {},
    }
    contentCatalog = mockContentCatalog([
      { family: 'page', relative: 'the-target.adoc' },
      { family: 'alias', relative: 'alias-a.adoc' },
      { family: 'alias', module: 'module-b', relative: 'alias-b.adoc' },
      { family: 'alias', component: 'component-b', version: '1.0', module: 'ROOT', relative: 'alias-c.adoc' },
      { family: 'alias', relative: 'old-target/index.adoc' },
      { family: 'alias', component: '', version: '', module: '', relative: 'index.adoc' },
    ])
    const targetPage = contentCatalog.getPages()[0]
    contentCatalog.findBy({ family: 'alias' }).forEach((file) => (file.rel = targetPage))
  })

  it('should run on all files in the alias family', () => {
    const emptyContentCatalog = mockContentCatalog().spyOn('findBy')
    const result = produceRedirects(playbook, emptyContentCatalog)
    expect(result).to.be.empty()
    expect(emptyContentCatalog.findBy).nth(1).called.with({ family: 'alias' })
  })

  it('should run on aliases specified as an array', () => {
    playbook.urls.redirectFacility = 'netlify'
    const result = produceRedirects(playbook, contentCatalog.findBy({ family: 'alias' }))
    expect(result).to.have.lengthOf(1)
    expect(result[0]).to.have.property('contents')
    expect(result[0].contents.toString()).to.include('/ /component-a/module-a/the-target.html 301!')
  })

  describe('static facility', () => {
    beforeEach(() => {
      playbook.urls.redirectFacility = 'static'
    })

    it('should populate contents of files in alias family with static redirect page', () => {
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.be.empty()
      const expectedQualifiedUrl = 'https://docs.example.org/component-a/module-a/the-target.html'
      const expectedRelativeUrls = {
        'alias-a.adoc': 'the-target.html',
        'old-target/index.adoc': '../the-target.html',
        'alias-b.adoc': '../module-a/the-target.html',
        'alias-c.adoc': '../../component-a/module-a/the-target.html',
        'index.adoc': 'component-a/module-a/the-target.html',
      }
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        const expectedRelativeUrl = expectedRelativeUrls[file.src.relative]
        expect(file).to.have.property('contents')
        const html = file.contents.toString()
        expect(html).to.include(`<link rel="canonical" href="${expectedQualifiedUrl}">`)
        expect(html).to.include(`<script>location="${expectedRelativeUrl}"</script>`)
        expect(html).to.include(`<meta http-equiv="refresh" content="0; url=${expectedRelativeUrl}">`)
        expect(html).to.include(`<a href="${expectedRelativeUrl}">${expectedQualifiedUrl}</a>`)
        expect(html).to.endWith('\n')
      })
    })

    it('should not populate contents for splat aliases', () => {
      contentCatalog = mockContentCatalog([
        { family: 'page', relative: 'the-target.adoc' },
        { family: 'alias', relative: 'alias-a.adoc' },
        { family: 'alias', component: 'component-b', version: 'current', module: 'ROOT', relative: '' },
      ])
      const targetPage = contentCatalog.getPages()[0]
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => (file.rel = targetPage))
      const splatAliasFile = contentCatalog.findBy({ family: 'alias' })[1]
      delete splatAliasFile.out
      splatAliasFile.pub.url = '/component-b/current'
      splatAliasFile.pub.splat = true
      splatAliasFile.rel = {
        src: { component: 'component-b', version: '1.0', module: 'ROOT', family: 'alias', relative: '' },
        pub: { url: '/component-b/1.0', moduleRootPath: '.', splat: true },
      }
      const expectedQualifiedUrl = 'https://docs.example.org/component-a/module-a/the-target.html'
      const expectedRelativeUrls = { 'alias-a.adoc': 'the-target.html' }
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.be.empty()
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        if (file.src.relative) {
          const expectedRelativeUrl = expectedRelativeUrls[file.src.relative]
          expect(file).to.have.property('contents')
          const html = file.contents.toString()
          expect(html).to.include(`<link rel="canonical" href="${expectedQualifiedUrl}">`)
          expect(html).to.include(`<script>location="${expectedRelativeUrl}"</script>`)
          expect(html).to.include(`<meta http-equiv="refresh" content="0; url=${expectedRelativeUrl}">`)
          expect(html).to.include(`<a href="${expectedRelativeUrl}">${expectedQualifiedUrl}</a>`)
          expect(html).to.endWith('\n')
        } else {
          expect(file).to.not.have.property('out')
          expect(file.contents.toString()).to.be.empty()
        }
      })
    })

    it('should encode spaces in URL of target page', () => {
      contentCatalog = mockContentCatalog([
        { family: 'page', relative: 'target with spaces.adoc' },
        { family: 'alias', relative: 'alias with spaces.adoc' },
      ])
      contentCatalog.findBy({ family: 'alias' })[0].rel = contentCatalog.getPages()[0]
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.be.empty()
      const expectedQualifiedUrl = 'https://docs.example.org/component-a/module-a/target%20with%20spaces.html'
      const expectedRelativeUrls = {
        'alias with spaces.adoc': 'target%20with%20spaces.html',
      }
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        const expectedRelativeUrl = expectedRelativeUrls[file.src.relative]
        expect(file).to.have.property('contents')
        const html = file.contents.toString()
        expect(html).to.include(`<link rel="canonical" href="${expectedQualifiedUrl}">`)
        expect(html).to.include(`<script>location="${expectedRelativeUrl}"</script>`)
        expect(html).to.include(`<meta http-equiv="refresh" content="0; url=${expectedRelativeUrl}">`)
        expect(html).to.include(`<a href="${expectedRelativeUrl}">${expectedQualifiedUrl}</a>`)
      })
    })

    it('should not remove the out property on alias files', () => {
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        expect(file).to.have.property('out')
      })
    })

    it('should remove trailing / from value of site.url', () => {
      playbook.site.url = playbook.site.url + '/'
      produceRedirects(playbook, contentCatalog)
      const expectedQualifiedUrl = 'https://docs.example.org/component-a/module-a/the-target.html'
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        const html = file.contents.toString()
        expect(html).to.include(`<link rel="canonical" href="${expectedQualifiedUrl}">`)
      })
    })

    it('should not add canonical link element if site.url not specified in playbook', () => {
      delete playbook.site.url
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        const html = file.contents.toString()
        expect(html).to.not.include('<link rel="canonical"')
        expect(html).to.not.include('undefined')
      })
    })

    it('should not add canonical link element if site.url is /', () => {
      playbook.site.url = '/'
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        const html = file.contents.toString()
        expect(html).to.not.include('<link rel="canonical"')
        expect(html).to.not.include('undefined')
      })
    })

    it('should not add canonical link element if site.url is a pathname', () => {
      playbook.site.url = '/docs'
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        const html = file.contents.toString()
        expect(html).to.not.include('<link rel="canonical"')
        expect(html).to.not.include('undefined')
      })
    })
  })

  describe('netlify facility', () => {
    beforeEach(() => {
      playbook.urls.redirectFacility = 'netlify'
    })

    it('should create and return netlify redirects file', () => {
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/ /component-a/module-a/the-target.html 301!',
        '/component-a/module-a/alias-a.html /component-a/module-a/the-target.html 301!',
        '/component-a/module-a/old-target/ /component-a/module-a/the-target.html 301!',
        '/component-a/module-a/old-target/index.html /component-a/module-a/the-target.html 301!',
        '/component-a/module-b/alias-b.html /component-a/module-a/the-target.html 301!',
        '/component-b/1.0/alias-c.html /component-a/module-a/the-target.html 301!',
        '/index.html /component-a/module-a/the-target.html 301!',
      ])
    })

    it('should generate temporary redirect for splat aliases', () => {
      contentCatalog = mockContentCatalog([
        { family: 'alias', component: 'component-b', version: 'current', module: 'ROOT', relative: '' },
      ])
      const splatAliasFile = contentCatalog.findBy({ family: 'alias' })[0]
      delete splatAliasFile.out
      splatAliasFile.pub.url = '/component-b/current'
      splatAliasFile.pub.splat = true
      splatAliasFile.rel = {
        src: { component: 'component-b', version: '1.0', module: 'ROOT', family: 'alias', relative: '' },
        pub: { url: '/component-b/1.0', moduleRootPath: '.', splat: true },
      }
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql(['/component-b/current/* /component-b/1.0/:splat 302!'])
    })

    it('should encode spaces in paths of redirect rule', () => {
      contentCatalog = mockContentCatalog([
        { family: 'page', relative: 'target with spaces.adoc' },
        { family: 'alias', relative: 'alias with spaces.adoc' },
      ])
      contentCatalog.findBy({ family: 'alias' })[0].rel = contentCatalog.getPages()[0]
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/component-a/module-a/alias%20with%20spaces.html /component-a/module-a/target%20with%20spaces.html 301!',
      ])
    })

    it('should not include extra redirect for directory if HTML URL extension style is indexify', () => {
      contentCatalog.getFiles().forEach((file) => {
        const url = file.pub.url
        file.pub.url = url.slice(0, url.length - (url.endsWith('/index.html') ? 11 : 5)) + '/'
      })
      playbook.urls.htmlExtensionStyle = 'indexify'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/ /component-a/module-a/the-target/ 301!',
        '/component-a/module-a/alias-a/ /component-a/module-a/the-target/ 301!',
        '/component-a/module-a/old-target/ /component-a/module-a/the-target/ 301!',
        '/component-a/module-b/alias-b/ /component-a/module-a/the-target/ 301!',
        '/component-b/1.0/alias-c/ /component-a/module-a/the-target/ 301!',
      ])
    })

    it('should not include extra redirect for directory if HTML URL extension style is drop', () => {
      contentCatalog.getFiles().forEach((file) => {
        const url = file.pub.url
        file.pub.url = url.slice(0, url.length - (url.endsWith('/index.html') ? 10 : 5))
      })
      playbook.urls.htmlExtensionStyle = 'drop'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/ /component-a/module-a/the-target 301!',
        '/component-a/module-a/alias-a /component-a/module-a/the-target 301!',
        '/component-a/module-a/old-target/ /component-a/module-a/the-target 301!',
        '/component-a/module-b/alias-b /component-a/module-a/the-target 301!',
        '/component-b/1.0/alias-c /component-a/module-a/the-target 301!',
      ])
    })

    it('should prefix each rewrite rule with URL context derived from absolute URL', () => {
      playbook.site.url = 'https://example.org/docs'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/docs/ /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-a/alias-a.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-a/old-target/ /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-a/old-target/index.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-b/alias-b.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-b/1.0/alias-c.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/index.html /docs/component-a/module-a/the-target.html 301!',
      ])
    })

    it('should prefix each rewrite rule with URL context derived from pathname', () => {
      playbook.site.url = '/docs'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/docs/ /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-a/alias-a.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-a/old-target/ /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-a/old-target/index.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-a/module-b/alias-b.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/component-b/1.0/alias-c.html /docs/component-a/module-a/the-target.html 301!',
        '/docs/index.html /docs/component-a/module-a/the-target.html 301!',
      ])
    })

    it('should drop trailing slash from site URL path when using it as prefix for rewrite rule', () => {
      playbook.site.url = 'https://example.org/docs/'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.include(
        '/docs/component-a/module-a/alias-a.html /docs/component-a/module-a/the-target.html 301!'
      )
    })

    it('should not prefix rewrite rule with extra prefix if URL context is /', () => {
      playbook.site.url = playbook.site.url + '/'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/ /component-a/module-a/the-target.html 301!',
        '/component-a/module-a/alias-a.html /component-a/module-a/the-target.html 301!',
        '/component-a/module-a/old-target/ /component-a/module-a/the-target.html 301!',
        '/component-a/module-a/old-target/index.html /component-a/module-a/the-target.html 301!',
        '/component-a/module-b/alias-b.html /component-a/module-a/the-target.html 301!',
        '/component-b/1.0/alias-c.html /component-a/module-a/the-target.html 301!',
        '/index.html /component-a/module-a/the-target.html 301!',
      ])
    })

    it('should remove the out property on alias files', () => {
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        expect(file).to.not.have.property('out')
      })
    })
  })

  // NOTE the only difference is that the force flag is missing; only cover code paths, not permutations
  describe('gitlab facility', () => {
    beforeEach(() => {
      playbook.urls.redirectFacility = 'gitlab'
    })

    it('should create and return netlify redirects file for gitlab', () => {
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/ /component-a/module-a/the-target.html 301',
        '/component-a/module-a/alias-a.html /component-a/module-a/the-target.html 301',
        '/component-a/module-a/old-target/ /component-a/module-a/the-target.html 301',
        '/component-a/module-a/old-target/index.html /component-a/module-a/the-target.html 301',
        '/component-a/module-b/alias-b.html /component-a/module-a/the-target.html 301',
        '/component-b/1.0/alias-c.html /component-a/module-a/the-target.html 301',
        '/index.html /component-a/module-a/the-target.html 301',
      ])
    })

    it('should generate temporary redirect for splat aliases', () => {
      contentCatalog = mockContentCatalog([
        { family: 'alias', component: 'component-b', version: 'current', module: 'ROOT', relative: '' },
      ])
      const splatAliasFile = contentCatalog.findBy({ family: 'alias' })[0]
      delete splatAliasFile.out
      splatAliasFile.pub.url = '/component-b/current'
      splatAliasFile.pub.splat = true
      splatAliasFile.rel = {
        src: { component: 'component-b', version: '1.0', module: 'ROOT', family: 'alias', relative: '' },
        pub: { url: '/component-b/1.0', moduleRootPath: '.', splat: true },
      }
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql(['/component-b/current/* /component-b/1.0/:splat 302'])
    })

    it('should not include extra redirect for directory if HTML URL extension style is indexify', () => {
      contentCatalog.getFiles().forEach((file) => {
        const url = file.pub.url
        file.pub.url = url.slice(0, url.length - (url.endsWith('/index.html') ? 11 : 5)) + '/'
      })
      playbook.urls.htmlExtensionStyle = 'indexify'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('_redirects')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        '/ /component-a/module-a/the-target/ 301',
        '/component-a/module-a/alias-a/ /component-a/module-a/the-target/ 301',
        '/component-a/module-a/old-target/ /component-a/module-a/the-target/ 301',
        '/component-a/module-b/alias-b/ /component-a/module-a/the-target/ 301',
        '/component-b/1.0/alias-c/ /component-a/module-a/the-target/ 301',
      ])
    })
  })

  describe('nginx facility', () => {
    beforeEach(() => {
      playbook.urls.redirectFacility = 'nginx'
    })

    it('should create and return nginx rewrite config file', () => {
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'location = /component-a/module-a/alias-a.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /component-a/module-a/old-target/index.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /component-a/module-b/alias-b.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /component-b/1.0/alias-c.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /index.html { return 301 /component-a/module-a/the-target.html; }',
      ])
    })

    it('should generate temporary redirect for splat aliases', () => {
      contentCatalog = mockContentCatalog([
        { family: 'alias', component: 'component-a', version: 'current', module: 'ROOT', relative: '' },
      ])
      const splatAliasFile = contentCatalog.findBy({ family: 'alias' })[0]
      delete splatAliasFile.out
      splatAliasFile.pub.url = '/component-a/current'
      splatAliasFile.pub.splat = true
      splatAliasFile.rel = {
        src: { component: 'component-a', version: '1.0', module: 'ROOT', family: 'alias', relative: '' },
        pub: { url: '/component-a/1.0', moduleRootPath: '.', splat: true },
      }
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'location ^~ /component-a/current/ { rewrite ^/component-a/current/(.*)$ /component-a/1.0/$1 redirect; }',
      ])
    })

    it('should escape special regex characters in splat pattern', () => {
      contentCatalog = mockContentCatalog([
        { family: 'alias', component: 'component-c++', version: 'current', module: 'ROOT', relative: '' },
      ])
      const splatAliasFile = contentCatalog.findBy({ family: 'alias' })[0]
      delete splatAliasFile.out
      splatAliasFile.pub.url = '/component-c++/1.0'
      splatAliasFile.pub.splat = true
      splatAliasFile.rel = {
        src: { component: 'component-c++', version: '1.0', module: 'ROOT', family: 'alias', relative: '' },
        pub: { url: '/component-c++/latest', moduleRootPath: '.', splat: true },
      }
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'location ^~ /component-c++/1.0/ { rewrite ^/component-c\\+\\+/1\\.0/(.*)$ /component-c++/latest/$1 redirect; }',
      ])
    })

    it('should enclose paths in quotes that contain spaces', () => {
      contentCatalog = mockContentCatalog([
        { family: 'page', relative: 'target with spaces.adoc' },
        { family: 'alias', relative: 'alias with spaces.adoc' },
      ])
      contentCatalog.findBy({ family: 'alias' })[0].rel = contentCatalog.getPages()[0]
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        "location = '/component-a/module-a/alias with spaces.html' { return 301 '/component-a/module-a/target with spaces.html'; }",
      ])
    })

    it('should prefix each rewrite rule with URL context derived from absolute URL', () => {
      playbook.site.url = 'https://example.org/docs'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'location = /docs/component-a/module-a/alias-a.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/component-a/module-a/old-target/index.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/component-a/module-b/alias-b.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/component-b/1.0/alias-c.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/index.html { return 301 /docs/component-a/module-a/the-target.html; }',
      ])
    })

    it('should prefix each rewrite rule with URL context derived from pathname', () => {
      playbook.site.url = '/docs'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'location = /docs/component-a/module-a/alias-a.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/component-a/module-a/old-target/index.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/component-a/module-b/alias-b.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/component-b/1.0/alias-c.html { return 301 /docs/component-a/module-a/the-target.html; }',
        'location = /docs/index.html { return 301 /docs/component-a/module-a/the-target.html; }',
      ])
    })

    it('should drop trailing slash from site URL path when using it as prefix for rewrite rule', () => {
      playbook.site.url = 'https://example.org/docs/'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.include(
        'location = /docs/component-a/module-a/alias-a.html { return 301 /docs/component-a/module-a/the-target.html; }'
      )
    })

    it('should not prefix rewrite rule with extra prefix if URL context is /', () => {
      playbook.site.url = playbook.site.url + '/'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.etc/nginx/rewrite.conf')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'location = /component-a/module-a/alias-a.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /component-a/module-a/old-target/index.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /component-a/module-b/alias-b.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /component-b/1.0/alias-c.html { return 301 /component-a/module-a/the-target.html; }',
        'location = /index.html { return 301 /component-a/module-a/the-target.html; }',
      ])
    })

    it('should remove the out property on alias files', () => {
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        expect(file).to.not.have.property('out')
      })
    })
  })

  describe('httpd facility', () => {
    beforeEach(() => {
      playbook.urls.redirectFacility = 'httpd'
    })

    it('should create and return httpd .htaccess config file', () => {
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'Redirect 301 /component-a/module-a/alias-a.html /component-a/module-a/the-target.html',
        'Redirect 301 /component-a/module-a/old-target/index.html /component-a/module-a/the-target.html',
        'Redirect 301 /component-a/module-b/alias-b.html /component-a/module-a/the-target.html',
        'Redirect 301 /component-b/1.0/alias-c.html /component-a/module-a/the-target.html',
        'Redirect 301 /index.html /component-a/module-a/the-target.html',
      ])
    })

    it('should generate temporary redirect for splat aliases', () => {
      contentCatalog = mockContentCatalog([
        { family: 'alias', component: 'component-b', version: 'current', module: 'ROOT', relative: '' },
      ])
      const splatAliasFile = contentCatalog.findBy({ family: 'alias' })[0]
      delete splatAliasFile.out
      splatAliasFile.pub.url = '/component-b/current'
      splatAliasFile.pub.splat = true
      splatAliasFile.rel = {
        src: { component: 'component-b', version: '1.0', module: 'ROOT', family: 'alias', relative: '' },
        pub: { url: '/component-b/1.0', moduleRootPath: '.', splat: true },
      }
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql(['Redirect 302 /component-b/current /component-b/1.0'])
    })

    it('should accept paths that contain spaces', () => {
      contentCatalog = mockContentCatalog([
        { family: 'page', relative: 'target with spaces.adoc' },
        { family: 'alias', relative: 'alias with spaces.adoc' },
      ])
      contentCatalog.findBy({ family: 'alias' })[0].rel = contentCatalog.findBy({ family: 'page' })[0]
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('contents')
      expect(result[0]).to.have.property('out')
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        "Redirect 301 '/component-a/module-a/alias with spaces.html' '/component-a/module-a/target with spaces.html'",
      ])
    })

    it('should prefix each rewrite rule with URL context derived from absolute URL', () => {
      playbook.site.url = 'https://example.org/docs'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'Redirect 301 /docs/component-a/module-a/alias-a.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/component-a/module-a/old-target/index.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/component-a/module-b/alias-b.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/component-b/1.0/alias-c.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/index.html /docs/component-a/module-a/the-target.html',
      ])
    })

    it('should prefix each rewrite rule with URL context derived from pathname', () => {
      playbook.site.url = '/docs'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'Redirect 301 /docs/component-a/module-a/alias-a.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/component-a/module-a/old-target/index.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/component-a/module-b/alias-b.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/component-b/1.0/alias-c.html /docs/component-a/module-a/the-target.html',
        'Redirect 301 /docs/index.html /docs/component-a/module-a/the-target.html',
      ])
    })

    it('should drop trailing slash from site URL path when using it as prefix for rewrite rule', () => {
      playbook.site.url = 'https://example.org/docs/'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.include(
        'Redirect 301 /docs/component-a/module-a/alias-a.html /docs/component-a/module-a/the-target.html'
      )
    })

    it('should not prefix rewrite rule with extra prefix if URL context is /', () => {
      playbook.site.url = playbook.site.url + '/'
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.have.lengthOf(1)
      expect(result[0].out.path).to.equal('.htaccess')
      expect(result[0].contents.toString()).to.endWith('\n')
      const rules = extractRules(result[0])
      expect(rules).to.eql([
        'Redirect 301 /component-a/module-a/alias-a.html /component-a/module-a/the-target.html',
        'Redirect 301 /component-a/module-a/old-target/index.html /component-a/module-a/the-target.html',
        'Redirect 301 /component-a/module-b/alias-b.html /component-a/module-a/the-target.html',
        'Redirect 301 /component-b/1.0/alias-c.html /component-a/module-a/the-target.html',
        'Redirect 301 /index.html /component-a/module-a/the-target.html',
      ])
    })

    it('should remove the out property on alias files', () => {
      produceRedirects(playbook, contentCatalog)
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        expect(file).to.not.have.property('out')
      })
    })
  })

  describe('disabled facility', () => {
    beforeEach(() => {
      playbook.urls.redirectFacility = 'disabled'
    })

    it('should remove out property from files in alias family', () => {
      const result = produceRedirects(playbook, contentCatalog)
      expect(result).to.be.empty()
      contentCatalog.findBy({ family: 'alias' }).forEach((file) => {
        expect(file).to.not.have.property('out')
      })
    })
  })

  // QUESTION should function return a single virtual file instead of an array?
})
