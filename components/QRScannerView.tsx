import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { ArrowLeft, Camera, AlertCircle } from 'lucide-react';

interface QRScannerViewProps {
    onBack: () => void;
    onScan: (posId: number) => void;
}

export const QRScannerView: React.FC<QRScannerViewProps> = ({ onBack, onScan }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationRef = useRef<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);

    useEffect(() => {
        let mounted = true;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setError(null);
                requestTick();
            } catch (e) {
                if (mounted) {
                    setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
                }
            }
        };

        const requestTick = () => {
            if (!videoRef.current || !videoRef.current.readyState || videoRef.current.readyState !== 4) {
                animationRef.current = requestAnimationFrame(requestTick);
                return;
            }
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!canvas || !mounted || !streamRef.current) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code && code.data) {
                    const match = code.data.match(/ref_pos=(\d+)/);
                    if (match) {
                        const posId = parseInt(match[1], 10);
                        setScanning(false);
                        streamRef.current.getTracks().forEach(t => t.stop());
                        streamRef.current = null;
                        onScan(posId);
                        return;
                    }
                }
            }
            animationRef.current = requestAnimationFrame(requestTick);
        };

        startCamera();
        return () => {
            mounted = false;
            cancelAnimationFrame(animationRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, [onScan]);

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            <header className="flex-shrink-0 flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-300 hover:text-white font-medium"
                >
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 className="text-lg font-bold text-[#ffd427] flex items-center gap-2">
                    <Camera size={22} /> Escanear QR
                </h1>
                <div className="w-20" />
            </header>

            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <p className="text-slate-400 text-sm text-center mb-4">
                    Apunta la cámara al código QR de la barbería para entrar directo a agendar.
                </p>

                {error ? (
                    <div className="flex flex-col items-center gap-4 p-6 bg-slate-800 rounded-xl max-w-sm">
                        <AlertCircle size={48} className="text-amber-400" />
                        <p className="text-slate-200 text-center">{error}</p>
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]"
                        >
                            Volver
                        </button>
                    </div>
                ) : (
                    <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden border-2 border-slate-600">
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover"
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {scanning && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-56 h-56 border-2 border-[#ffd427] rounded-xl bg-transparent" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRScannerView;
