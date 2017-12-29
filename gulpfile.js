var gulp = require('gulp'),
  jshint = require('gulp-jshint'),
  stylish = require('jshint-stylish'),
  mocha = require('gulp-mocha')

// gulp.task('lint', function() {
//   return gulp.src(['./lib/**/*.js', './test/*.js'])
//     .pipe(jshint({node: true, mocha: true}))
//     .pipe(jshint.reporter(stylish))
//     .pipe(jshint.reporter('fail'));
// });

gulp.task('middleware-test', function() {
  return gulp.src(['test/middleware.spec.js'], { read: false }).pipe(mocha({ timeout: 2000 }))
})

gulp.task('dbAuth-test', ['middleware-test'], function() {
  return gulp.src(['test/dbAuth.spec.js'], { read: false }).pipe(mocha({ timeout: 2000 }))
})

gulp.task('session-test', ['dbAuth-test'], function() {
  return gulp.src(['test/session.spec.js'], { read: false }).pipe(mocha({ timeout: 2000 }))
})

gulp.task('mailer-test', ['dbAuth-test'], function() {
  return gulp.src(['test/mailer.spec.js'], { read: false }).pipe(mocha({ timeout: 2000 }))
})

gulp.task('user-test', ['dbAuth-test'], function() {
  return gulp.src(['test/user.spec.js'], { read: false }).pipe(mocha({ timeout: 2000 }))
})

gulp.task('final-test', ['user-test'], function() {
  return gulp.src(['test/test.js'], { read: false }).pipe(mocha({ timeout: 2000 }))
})

gulp.task('default', ['final-test', 'user-test', 'mailer-test', 'session-test', 'middleware-test'])
