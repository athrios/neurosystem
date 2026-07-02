import React, { useEffect, useRef, useState } from 'react';
import { Check, Crop, RotateCcw, X } from 'lucide-react';

const ASPECTS = {
  original: { label: 'Original' },
  square: { label: 'Quadrado', ratio: 1 },
  wide: { label: 'Horizontal', ratio: 3 },
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function LogoEditorModal({ source, onCancel, onApply }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [dimensions, setDimensions] = useState(null);
  const [aspect, setAspect] = useState('original');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [error, setError] = useState('');

  const targetRatio = aspect === 'original'
    ? (dimensions?.width || 3) / (dimensions?.height || 1)
    : ASPECTS[aspect].ratio;

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => setError('Não foi possível abrir esta imagem.');
    image.src = source;
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !dimensions) return;

    const previewWidth = 900;
    const previewHeight = Math.round(previewWidth / targetRatio);
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, previewWidth, previewHeight);

    const baseScale = Math.max(
      previewWidth / dimensions.width,
      previewHeight / dimensions.height,
    );
    const scale = baseScale * zoom;
    const drawWidth = dimensions.width * scale;
    const drawHeight = dimensions.height * scale;
    const maxX = Math.max(0, (drawWidth - previewWidth) / 2);
    const maxY = Math.max(0, (drawHeight - previewHeight) / 2);
    const x = (previewWidth - drawWidth) / 2 + (offsetX / 100) * maxX;
    const y = (previewHeight - drawHeight) / 2 + (offsetY / 100) * maxY;

    context.drawImage(image, x, y, drawWidth, drawHeight);
  }, [dimensions, offsetX, offsetY, targetRatio, zoom]);

  function reset() {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }

  function chooseAspect(value) {
    setAspect(value);
    reset();
  }

  function handlePointerDown(event) {
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX,
      offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - dragRef.current.x) / rect.width) * 200;
    const deltaY = ((event.clientY - dragRef.current.y) / rect.height) * 200;
    setOffsetX(clamp(dragRef.current.offsetX + deltaX, -100, 100));
    setOffsetY(clamp(dragRef.current.offsetY + deltaY, -100, 100));
  }

  function handlePointerUp(event) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function apply() {
    const preview = canvasRef.current;
    if (!preview || !dimensions) return;

    const output = document.createElement('canvas');
    const maxWidth = aspect === 'square' ? 800 : 1200;
    output.width = Math.min(maxWidth, preview.width);
    output.height = Math.round(output.width / targetRatio);
    const context = output.getContext('2d');
    context.drawImage(preview, 0, 0, output.width, output.height);
    onApply(output.toDataURL('image/webp', 0.9));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logo-editor-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'grid', placeItems: 'center', padding: 20,
        background: 'rgba(18,18,16,.68)',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 720, maxHeight: '94vh', overflowY: 'auto',
        background: 'var(--surface)', borderRadius: 14, padding: 20,
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 16,
        }}>
          <div>
            <h2 id="logo-editor-title" style={{ fontSize: 16, fontWeight: 650 }}>
              Ajustar logotipo
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              Arraste a imagem para escolher o enquadramento.
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Fechar editor">
            <X size={18} />
          </button>
        </div>

        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12,
        }}>
          {Object.entries(ASPECTS).map(([value, option]) => (
            <button
              type="button"
              key={value}
              onClick={() => chooseAspect(value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 10px', borderRadius: 7,
                border: `1px solid ${aspect === value ? 'var(--accent)' : 'var(--border)'}`,
                background: aspect === value ? 'var(--accent-bg)' : 'transparent',
                color: aspect === value ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 12,
              }}
            >
              <Crop size={13} /> {option.label}
            </button>
          ))}
        </div>

        <div style={{
          display: 'grid', placeItems: 'center', minHeight: 220,
          padding: 12, borderRadius: 10, background: '#ECEAE4',
          overflow: 'hidden',
        }}>
          {error ? (
            <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>
          ) : (
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { dragRef.current = null; }}
              style={{
                display: dimensions ? 'block' : 'none',
                width: '100%', maxHeight: 410, objectFit: 'contain',
                border: '1px solid rgba(0,0,0,.18)', background: 'transparent',
                cursor: 'grab', touchAction: 'none',
              }}
            />
          )}
          {!dimensions && !error && (
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Carregando imagem...</span>
          )}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 15 }}>
          <label style={{ display: 'grid', gridTemplateColumns: '90px 1fr 42px', gap: 9, alignItems: 'center', fontSize: 12 }}>
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={event => setZoom(Number(event.target.value))}
            />
            <span>{zoom.toFixed(1)}×</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '90px 1fr 42px', gap: 9, alignItems: 'center', fontSize: 12 }}>
            Horizontal
            <input
              type="range"
              min="-100"
              max="100"
              value={offsetX}
              onChange={event => setOffsetX(Number(event.target.value))}
            />
            <span>{offsetX}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '90px 1fr 42px', gap: 9, alignItems: 'center', fontSize: 12 }}>
            Vertical
            <input
              type="range"
              min="-100"
              max="100"
              value={offsetY}
              onChange={event => setOffsetY(Number(event.target.value))}
            />
            <span>{offsetY}</span>
          </label>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 10, marginTop: 18,
        }}>
          <button
            type="button"
            onClick={reset}
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)', fontSize: 12 }}
          >
            <RotateCcw size={14} /> Restaurar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 13px', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-2)',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!dimensions}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff', fontWeight: 600,
              }}
            >
              <Check size={14} /> Aplicar corte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
