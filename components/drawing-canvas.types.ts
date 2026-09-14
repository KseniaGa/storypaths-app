export type DrawingCanvasRef = {
  clearSignature: () => void;
  readSignature: () => void;
  draw: () => void;
  changePenColor: (color: string) => void;
  changePenSize: (minWidth: number, maxWidth: number) => void;
  erase: () => void;
  setDataURL: (dataUrl: string) => void;
};

export type DrawingCanvasProps = {
  dataURL?: string;
  penColor: string;
  backgroundColor: string;
  minWidth: number;
  maxWidth: number;
  onOK: (signature: string) => void;
  onEmpty: () => void;
  onBegin: () => void;
  onEnd: () => void;
  onLoadEnd: () => void;
  onError: (error: unknown) => void;
};
