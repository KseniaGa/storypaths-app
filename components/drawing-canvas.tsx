import { forwardRef, useImperativeHandle, useRef } from "react";
import SignatureScreen, {
  type SignatureViewRef,
} from "react-native-signature-canvas";
import type {
  DrawingCanvasProps,
  DrawingCanvasRef,
} from "./drawing-canvas.types";

export type { DrawingCanvasRef } from "./drawing-canvas.types";

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  (props, ref) => {
    const signatureRef = useRef<SignatureViewRef | null>(null);

    useImperativeHandle(ref, () => ({
      clearSignature: () => signatureRef.current?.clearSignature(),
      readSignature: () => signatureRef.current?.readSignature(),
      draw: () => signatureRef.current?.draw(),
      changePenColor: (color) => signatureRef.current?.changePenColor(color),
      changePenSize: (minWidth, maxWidth) =>
        signatureRef.current?.changePenSize(minWidth, maxWidth),
      erase: () => signatureRef.current?.erase(),
      setDataURL: (dataUrl) => signatureRef.current?.setDataURL(dataUrl),
    }));

    return (
      <SignatureScreen
        ref={signatureRef}
        {...props}
        descriptionText="Draw a symbol, memory, map, or feeling"
        clearText="Clear"
        confirmText="Save drawing"
        androidLayerType="hardware"
        webStyle={`
          .m-signature-pad { box-shadow: none; border: none; }
          .m-signature-pad--body { border: none; }
          .m-signature-pad--footer { display: none; }
          body, html { background-color: ${props.backgroundColor}; }
        `}
      />
    );
  },
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;
