/* Minimal BSD <err.h> replacement for building sidreloc with MinGW. */
#ifndef C64AE_ERR_H
#define C64AE_ERR_H
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <errno.h>
static void c64ae_vwarn(int with_errno, const char *fmt, va_list ap) {
  int e = errno;
  fprintf(stderr, "sidreloc: ");
  if (fmt) vfprintf(stderr, fmt, ap);
  if (with_errno) fprintf(stderr, "%s%s", fmt ? ": " : "", strerror(e));
  fprintf(stderr, "\n");
}
static void warn(const char *fmt, ...) { va_list ap; va_start(ap, fmt); c64ae_vwarn(1, fmt, ap); va_end(ap); }
static void warnx(const char *fmt, ...) { va_list ap; va_start(ap, fmt); c64ae_vwarn(0, fmt, ap); va_end(ap); }
static void err(int code, const char *fmt, ...) { va_list ap; va_start(ap, fmt); c64ae_vwarn(1, fmt, ap); va_end(ap); exit(code); }
static void errx(int code, const char *fmt, ...) { va_list ap; va_start(ap, fmt); c64ae_vwarn(0, fmt, ap); va_end(ap); exit(code); }
#endif
