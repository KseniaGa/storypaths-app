// Signature Canvas 5 initializes its bitmap once. If the WebView subsequently
// changes size, CSS scales the bitmap but the library still uses CSS pixels for
// points. Convert those points to the original drawing space, keeping existing
// strokes and undo snapshots intact instead of resizing/clearing the bitmap.
export const NATIVE_DRAWING_COORDINATES = `
(function () {
  if (typeof signaturePad === 'undefined' || !signaturePad.canvas ||
      signaturePad.__branchBeetleCoordinates) return;
  var originalCreatePoint = signaturePad._createPoint;
  if (typeof originalCreatePoint !== 'function') return;
  signaturePad.__branchBeetleCoordinates = true;
  signaturePad._createPoint = function (x, y) {
    var canvas = this.canvas;
    var rect = canvas.getBoundingClientRect();
    var context = canvas.getContext('2d');
    var transform = context.getTransform();
    if (rect.width > 0 && rect.height > 0 && transform.a > 0 && transform.d > 0) {
      x = rect.left + (x - rect.left) * canvas.width / (rect.width * transform.a);
      y = rect.top + (y - rect.top) * canvas.height / (rect.height * transform.d);
    }
    return originalCreatePoint.call(this, x, y);
  };
})();
true;
`;
