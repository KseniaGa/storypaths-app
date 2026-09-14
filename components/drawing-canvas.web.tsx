import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type {
  DrawingCanvasProps,
  DrawingCanvasRef,
} from "./drawing-canvas.types";

export type { DrawingCanvasRef } from "./drawing-canvas.types";

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  (
    {
      dataURL,
      penColor,
      backgroundColor,
      minWidth,
      maxWidth,
      onOK,
      onEmpty,
      onBegin,
      onEnd,
      onLoadEnd,
      onError,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const erasingRef = useRef(false);
    const penColorRef = useRef(penColor);
    const penWidthRef = useRef((minWidth + maxWidth) / 2);
    const backgroundColorRef = useRef(backgroundColor);
    const dataUrlRef = useRef(dataURL);
    const onErrorRef = useRef(onError);
    const onLoadEndRef = useRef(onLoadEnd);

    const prepareContext = useCallback(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return null;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = penWidthRef.current;
      context.strokeStyle = erasingRef.current
        ? backgroundColorRef.current
        : penColorRef.current;
      return { canvas, context };
    }, []);

    const clearCanvas = useCallback(() => {
      const prepared = prepareContext();
      if (!prepared) return;
      const { canvas, context } = prepared;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = backgroundColorRef.current;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
      emptyRef.current = true;
    }, [prepareContext]);

    const loadDataUrl = useCallback((nextDataUrl: string) => {
      const prepared = prepareContext();
      if (!prepared) return;
      const { canvas, context } = prepared;
      if (!nextDataUrl) {
        clearCanvas();
        return;
      }

      const image = new Image();
      image.onload = () => {
        clearCanvas();
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.restore();
        emptyRef.current = false;
      };
      image.onerror = () =>
        onErrorRef.current(new Error("The drawing could not be loaded."));
      image.src = nextDataUrl;
    }, [clearCanvas, prepareContext]);

    useImperativeHandle(ref, () => ({
      clearSignature: clearCanvas,
      readSignature: () => {
        const canvas = canvasRef.current;
        if (!canvas || emptyRef.current) {
          onEmpty();
          return;
        }
        onOK(canvas.toDataURL("image/png"));
      },
      draw: () => {
        erasingRef.current = false;
      },
      changePenColor: (color) => {
        penColorRef.current = color;
      },
      changePenSize: (nextMinWidth, nextMaxWidth) => {
        penWidthRef.current = (nextMinWidth + nextMaxWidth) / 2;
      },
      erase: () => {
        erasingRef.current = true;
      },
      setDataURL: loadDataUrl,
    }));

    useEffect(() => {
      penColorRef.current = penColor;
    }, [penColor]);

    useEffect(() => {
      penWidthRef.current = (minWidth + maxWidth) / 2;
    }, [maxWidth, minWidth]);

    useEffect(() => {
      backgroundColorRef.current = backgroundColor;
    }, [backgroundColor]);

    useEffect(() => {
      dataUrlRef.current = dataURL;
    }, [dataURL]);

    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
      onLoadEndRef.current = onLoadEnd;
    }, [onLoadEnd]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        const previous = canvas.width > 0 && canvas.height > 0
          ? canvas.toDataURL("image/png")
          : "";
        const rect = canvas.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rect.width * scale));
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        const context = canvas.getContext("2d");
        context?.setTransform(scale, 0, 0, scale, 0, 0);

        if (dataUrlRef.current || (!emptyRef.current && previous)) {
          loadDataUrl(dataUrlRef.current || previous);
        } else {
          clearCanvas();
        }
      };

      resizeCanvas();
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", resizeCanvas);
        onLoadEndRef.current();
        return () => window.removeEventListener("resize", resizeCanvas);
      }

      const observer = new ResizeObserver(resizeCanvas);
      observer.observe(canvas);
      onLoadEndRef.current();
      return () => observer.disconnect();
    }, [clearCanvas, loadDataUrl]);

    useEffect(() => {
      if (dataURL) loadDataUrl(dataURL);
    }, [dataURL, loadDataUrl]);

    const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const prepared = prepareContext();
      const point = pointFromEvent(event);
      if (!prepared || !point) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      prepared.context.beginPath();
      prepared.context.moveTo(point.x, point.y);
      drawingRef.current = true;
      emptyRef.current = false;
      onBegin();
    };

    const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const prepared = prepareContext();
      const point = pointFromEvent(event);
      if (!prepared || !point) return;
      event.preventDefault();
      prepared.context.lineTo(point.x, point.y);
      prepared.context.stroke();
    };

    const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      continueStroke(event);
      drawingRef.current = false;
      onEnd();
    };

    return (
      <canvas
        ref={canvasRef}
        aria-label="Drawing canvas"
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          minHeight: 180,
          backgroundColor,
          cursor: erasingRef.current ? "cell" : "crosshair",
          touchAction: "none",
        }}
      />
    );
  },
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;
