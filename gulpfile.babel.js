import { src, dest, parallel, series, watch } from 'gulp';
import babel from 'gulp-babel';
import uglify from 'gulp-uglify';
import cleanCSS from 'gulp-clean-css';
import rename from 'gulp-rename';
import replace from 'gulp-replace';

// Define source and destination directory mappings
const path = {
  js: './src/colorpickup.js',
  css: './src/colorpickup.css',
  dist: './dist'
};

/**
 * JS Compilation Task:
 * 1. Read 'src/colorpickup.js'
 * 2. Transpile ES6+ to browser-compatible ES5 (via Babel)
 * 3. Remove strict mode declarations to prevent context pollution in specific bundles
 * 4. Write unminified 'dist/colorpickup.js'
 * 5. Compress and optimize via Uglify (preserving license comments)
 * 6. Rename and write minified 'dist/colorpickup.min.js'
 */
function compileJS() {
  return src(path.js)
    .pipe(babel({ retainLines: true }))
    .pipe(replace('"use strict";', ''))
    .pipe(dest(path.dist))
    .pipe(uglify({
      output: {
        comments: /^!/
      }
    }))
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest(path.dist));
}

/**
 * CSS Compilation Task:
 * 1. Read 'src/colorpickup.css'
 * 2. Write unminified 'dist/colorpickup.css' to target destination
 * 3. Minify and compress rules through CleanCSS
 * 4. Rename and write minified 'dist/colorpickup.min.css'
 */
function compileCSS() {
  // Pass unminified copy directly to dist
  src(path.css).pipe(dest(path.dist));

  // Run minification pipeline
  return src(path.css)
    .pipe(cleanCSS({ level: 1 }))
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest(path.dist));
}

/**
 * Watcher Task:
 * Listens for local changes inside the '/src' directory to trigger incremental builds
 */
function watchFiles() {
  watch(path.js, compileJS);
  watch(path.css, compileCSS);
}

// Named Exports
export const build = parallel(compileJS, compileCSS);
export default series(build, watchFiles);