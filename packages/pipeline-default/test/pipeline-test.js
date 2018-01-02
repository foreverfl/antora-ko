/* eslint-env mocha */
'use strict'

const { expect } = require('../../../test/test-utils')

const cheerio = require('cheerio')
const fs = require('fs-extra')
const generateSite = require('@antora/pipeline-default')
const git = require('nodegit')
const path = require('path')

const CWD = process.cwd()
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures')
const WORK_DIR = path.resolve(__dirname, 'work')
const PROJECT_DIR = path.resolve(__dirname, '../../..')
const TIMEOUT = 5000
const UI_BUNDLE_URI =
  'https://gitlab.com/antora/antora-ui-default/-/jobs/artifacts/master/raw/build/ui-bundle.zip?job=bundle-stable'

describe('generateSite()', () => {
  let $
  let currentBranch
  let startPath
  let playbookSpec
  let playbookSpecFile
  let destDir
  let uiBundleUri

  const getCurrentBranch = async () => {
    const repo = await git.Repository.open(PROJECT_DIR)
    const result = (await repo.getCurrentBranch()).name().replace(/^.+\//, '')
    repo.free()
    return result
  }

  const readFile = (file, dir) => fs.readFileSync(dir ? path.join(dir, file) : file, 'utf8')

  const loadHtmlFile = (relative) => cheerio.load(readFile(relative, destDir))

  before(async function () {
    currentBranch = await getCurrentBranch()
    startPath = path.relative(PROJECT_DIR, path.join(FIXTURES_DIR, 'the-component-2.0'))
    playbookSpecFile = path.join(WORK_DIR, 'the-site.json')
    destDir = path.join(WORK_DIR, '_site')
    uiBundleUri = UI_BUNDLE_URI
  })

  beforeEach(() => {
    fs.emptyDirSync(destDir)
    process.chdir(WORK_DIR)
    playbookSpec = {
      site: { title: 'The Site' },
      content: {
        sources: [{ url: PROJECT_DIR, branches: currentBranch, start_path: startPath }],
      },
      ui: { bundle: uiBundleUri },
    }
  })

  after(() => {
    if (process.env.KEEP_CACHE) {
      fs.removeSync(destDir)
      fs.removeSync(playbookSpecFile)
    } else {
      fs.removeSync(WORK_DIR)
    }
    process.chdir(CWD)
  })

  it('should generate site into output directory', async () => {
    fs.writeJsonSync(playbookSpecFile, playbookSpec)
    await generateSite(['--playbook', playbookSpecFile], {}, destDir)
    expect(path.join(destDir, '_'))
      .to.be.a.directory()
      .with.subDirs.that.include.members(['css', 'js', 'font', 'img'])
    expect(path.join(destDir, '_/css/site.css')).to.be.a.file()
    expect(path.join(destDir, '_/js/site.js')).to.be.a.file()
    expect(path.join(destDir, 'the-component'))
      .to.be.a.directory()
      .with.subDirs(['2.0'])
    expect(path.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    expect($('head > title')).to.have.text('Index Page :: The Site')
    // assert relative UI path is correct
    expect($('head > link[rel=stylesheet]')).to.have.attr('href', '../../_/css/site.css')
    expect($('script')).to.have.attr('src', '../../_/js/site.js')
    // assert current component version is correct
    expect($('.navigation-explore .current .title')).to.have.text('The Component')
    expect($('.navigation-explore .component.is-current .title')).to.have.text('The Component')
    expect($('.navigation-explore .component.is-current .version')).to.have.lengthOf(1)
    expect($('.navigation-explore .component.is-current .version a')).to.have.text('2.0')
    expect($('.navigation-explore .component.is-current .version.is-current a')).to.have.text('2.0')
    expect($('.navigation-explore .component.is-current .version.is-latest a')).to.have.text('2.0')
    // assert paths in navigation are relativized
    expect($('nav.nav-menu .nav-link')).to.have.attr('href', 'index.html')
    expect($('article h1')).to.have.text('Index Page')
    expect($('article img')).to.have.attr('src', '_images/activity-diagram.svg')
    expect(path.join(destDir, 'the-component/2.0/_images')).to.be.a.directory()
    expect(path.join(destDir, 'the-component/2.0/_images/activity-diagram.svg')).to.be.a.file()
    expect(path.join(destDir, 'the-component/2.0/the-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/the-page.html')
    expect($('nav.nav-menu .is-current-page')).to.have.lengthOf(1)
    expect($('nav.nav-menu .is-current-page > a.nav-link')).to.have.attr('href', 'the-page.html')
    expect($('.page-versions')).to.not.exist()
  }).timeout(TIMEOUT)

  it('should indexify URLs to internal pages', async () => {
    playbookSpec.urls = { html_extension_style: 'indexify' }
    fs.writeJsonSync(playbookSpecFile, playbookSpec)
    await generateSite(['--playbook', playbookSpecFile], {}, destDir)
    expect(path.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    expect($('article a.page')).to.have.attr('href', 'the-page/')
    expect($('nav.crumbs a')).to.have.attr('href', './')
    expect($('nav.nav-menu .nav-link')).to.have.attr('href', './')
    expect(path.join(destDir, 'the-component/2.0/the-page/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/the-page/index.html')
    expect($('nav.nav-menu .nav-link')).to.have.attr('href', '../')
    expect($('head > link[rel=stylesheet]')).to.have.attr('href', '../../../_/css/site.css')
  }).timeout(TIMEOUT)

  it('should qualify applicable links using site url if set in playbook', async () => {
    playbookSpec.site.url = 'https://example.com/docs/'
    fs.writeJsonSync(playbookSpecFile, playbookSpec)
    await generateSite(['--playbook', playbookSpecFile], {}, destDir)
    expect(path.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    expect($('head link[rel=canonical]')).to.have.attr('href', 'https://example.com/docs/the-component/2.0/index.html')
    expect($('nav.navbar .navbar-brand .navbar-item')).to.have.attr('href', 'https://example.com/docs')
  }).timeout(TIMEOUT)

  it('should provide navigation to multiple versions of a component', async () => {
    playbookSpec.content.sources.push({
      url: PROJECT_DIR,
      branches: currentBranch,
      start_path: path.relative(PROJECT_DIR, path.join(FIXTURES_DIR, 'the-component-1.0')),
    })
    fs.writeJsonSync(playbookSpecFile, playbookSpec)
    await generateSite(['--playbook', playbookSpecFile], {}, destDir)
    expect(path.join(destDir, 'the-component'))
      .to.be.a.directory()
      .with.subDirs(['1.0', '2.0'])
    expect(path.join(destDir, 'the-component/2.0/the-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/the-page.html')
    // assert that all versions of page are shown
    expect($('.page-versions')).to.exist()
    expect($('.page-versions .versions-menu-toggle')).to.have.text('2.0')
    expect($('.page-versions a.version')).to.have.lengthOf(2)
    expect($('.page-versions a.version.is-current'))
      .to.have.lengthOf(1)
      .and.to.have.text('2.0')
      .and.to.have.attr('href', 'the-page.html')
    expect($('.page-versions a.version:not(.is-current)'))
      .to.have.lengthOf(1)
      .and.to.have.text('1.0')
      .and.to.have.attr('href', '../1.0/the-page.html')
    expect(path.join(destDir, 'the-component/1.0/new-page.html')).to.not.be.a.path()
    expect(path.join(destDir, 'the-component/2.0/new-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/new-page.html')
    expect($('.page-versions a.version')).to.have.lengthOf(2)
    expect($('.page-versions a.version:not(.is-current)'))
      .to.have.lengthOf(1)
      .and.to.have.class('is-missing')
      .and.to.have.text('1.0')
      .and.to.have.attr('href', '../1.0/index.html')
    // assert that all versions of component are present in navigation explore panel
    expect($('.navigation-explore .component.is-current li.version')).to.have.lengthOf(2)
    expect(
      $('.navigation-explore .component.is-current li.version')
        .eq(0)
        .find('a')
    )
      .to.have.text('2.0')
      .and.to.have.attr('href', 'index.html')
    expect(
      $('.navigation-explore .component.is-current li.version')
        .eq(1)
        .find('a')
    )
      .to.have.text('1.0')
      .and.to.have.attr('href', '../1.0/index.html')
    expect(path.join(destDir, 'the-component/1.0/the-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/1.0/the-page.html')
    expect($('.navigation-explore .component.is-current .version')).to.have.lengthOf(2)
    expect($('.navigation-explore .component.is-current .version.is-latest a')).to.have.text('2.0')
    expect($('.navigation-explore .component.is-current .version.is-current a')).to.have.text('1.0')
  }).timeout(TIMEOUT)

  it('should provide navigation to all versions of all components', async () => {
    playbookSpec.content.sources.push(
      ...[
        {
          url: PROJECT_DIR,
          branches: currentBranch,
          start_path: path.relative(PROJECT_DIR, path.join(FIXTURES_DIR, 'the-component-1.0')),
        },
        {
          url: PROJECT_DIR,
          branches: currentBranch,
          start_path: path.relative(PROJECT_DIR, path.join(FIXTURES_DIR, 'the-other-component')),
        },
        {
          url: PROJECT_DIR,
          branches: currentBranch,
          start_path: path.relative(PROJECT_DIR, path.join(FIXTURES_DIR, 'the-other-component-1.0')),
        },
      ]
    )
    fs.writeJsonSync(playbookSpecFile, playbookSpec)
    await generateSite(['--playbook', playbookSpecFile], {}, destDir)
    expect(path.join(destDir, 'the-other-component')).to.be.a.directory()
    expect(path.join(destDir, 'the-other-component/core/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-other-component/core/index.html')
    expect($('.navigation-explore .component')).to.have.lengthOf(2)
    // assert sorted by title
    expect(
      $('.navigation-explore .component')
        .eq(0)
        .find('.title')
    ).to.have.text('The Component')
    expect(
      $('.navigation-explore .component')
        .eq(1)
        .find('.title')
    ).to.have.text('The Other Component')
    // assert correct component is marked as current
    expect($('.navigation-explore .component').eq(1)).to.have.class('is-current')
    expect($('.navigation-explore .component.is-current a')).to.have.lengthOf(2)
    expect($('.navigation-explore .component.is-current a').eq(0)).to.have.text('master')
    expect($('.navigation-explore .component.is-current .version').eq(0))
      .to.have.class('is-current')
      .and.to.have.class('is-latest')
    expect(path.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    // assert component link points to start page
    expect($('.navigation-explore .component:not(.is-current) a').eq(0)).to.have.attr(
      'href',
      '../../the-other-component/core/index.html'
    )
  }).timeout(TIMEOUT)

  // to test:
  // test if component start page is missing (current throws an error because its undefined)
  // path to images from topic dir
})
