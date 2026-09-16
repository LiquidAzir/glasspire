// Publish only game files. Local saves, tests and editable art stay out of dist.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
const output = path.resolve(root, 'dist');
const files = [
  'index.html', 'styles.css', 'interface.css', 'config.js', 'cloud.js',
  'audio.js', 'app.js', 'render3d.js', 'builders.js', 'spire-art.js', 'spire-world.js',
  'favicon.png', 'manifest.webmanifest', 'vendor/three-0.169.0.module.js',
  'assets/spire-kit.json',
  ...['warrior', 'mage', 'ranger', 'summoner', 'paladin', 'gate'].map(name => `ui-art/${name}.svg`),
];
const sources = new Map(files.map(name => {
  const raw = fs.readFileSync(path.join(root, name));
  // Git checkouts on Windows and Render must produce the same release digest.
  const data = /\.(html|css|js|json|svg|webmanifest)$/.test(name) ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')) : raw;
  return [name, data];
}));
const digest = crypto.createHash('sha256');
for (const [name, data] of sources) digest.update(name).update(data);
digest.update(fs.readFileSync(__filename, 'utf8').replace(/\r\n/g, '\n'));
const version = digest.digest('hex').slice(0, 16);
// This one build-owned output folder is the only path ever removed.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid output directory');
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output) throw new Error('Unsafe output directory');
  fs.rmSync(output, {recursive:true});
}
fs.mkdirSync(output);
const manifest = {version, files:{}};
for (const [name, original] of sources) {
  let data = original;
  if (/\.(html|css|js|webmanifest)$/.test(name) && !name.startsWith('vendor/')) {
    let text = data.toString('utf8');
    // Version local static dependencies, including module imports, CSS artwork
    // and import-map entries. Unrelated strings, cloud URLs and save keys stay intact.
    for (const asset of files.filter(file => file !== 'index.html')) {
      const relative = path.posix.relative(path.posix.dirname(name), asset);
      for (const reference of new Set([relative, './' + relative])) {
        if (!reference) continue;
        for (const quote of ['"', "'"]) text = text.split(quote + reference + quote).join(quote + reference + '?v=' + version + quote);
      }
    }
    data = Buffer.from(text);
  }
  const target = path.join(output, name);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, data);
  manifest.files[name] = {bytes:data.length, sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${files.length} game files; release ${version}`);
