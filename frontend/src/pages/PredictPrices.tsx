import React, { useState } from 'react';
import { getToken } from '../utils/auth';

const API_URL = import.meta.env.VITE_AI_API_URL ?? '';

interface PredictionResult {
  garment: string;
  garment_confidence: number;
  fabric: string;
  fabric_confidence: number;
  estimated_price_range: {
    min: number;
    max: number;
  };
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid var(--border-default)`,
        borderTopColor: 'var(--cyan-500)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}

const PredictPrices = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState('');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError('');
    }
  };

  const handlePredict = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedImage);

    try {
      const response = await fetch(`${API_URL}/api/predict/garment`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Prediction failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to predict. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setResult(null);
    setError('');
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        
        .upload-zone {
          border: 2px dashed var(--border-default);
          border-radius: var(--radius-xl);
          padding: 48px 32px;
          text-align: center;
          background: var(--bg-surface);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .upload-zone:hover {
          border-color: var(--cyan-500);
          background: rgba(0, 180, 216, 0.05);
        }
        
        .upload-zone.has-image {
          border-style: solid;
          border-color: var(--cyan-500);
        }
        
        .result-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: 24px;
          animation: fadeIn 0.4s ease;
        }
        
        .confidence-bar {
          height: 8px;
          background: var(--bg-subtle);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-top: 8px;
        }
        
        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--cyan-500), var(--cyan-400));
          border-radius: var(--radius-full);
          transition: width 0.6s ease;
        }
      `}</style>

      <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            margin: '0 0 8px',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
          }}>
            🤖 AI Price Prediction
          </h1>
          <p style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            Upload a garment image to get instant fabric detection and price estimation
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: result ? '1fr 1fr' : '1fr',
          gap: 24,
          alignItems: 'start',
        }}>
          {/* Upload Section */}
          <div>
            <label
              className={`upload-zone ${previewUrl ? 'has-image' : ''}`}
              style={{
                display: 'block',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />

              {previewUrl ? (
                <div style={{ animation: 'scaleIn 0.3s ease' }}>
                  <img
                    src={previewUrl}
                    alt="Selected garment"
                    style={{
                      width: '100%',
                      maxHeight: 400,
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  />
                  <p style={{
                    marginTop: 16,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-tertiary)',
                  }}>
                    {selectedImage?.name}
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{
                    width: 64,
                    height: 64,
                    margin: '0 auto 16px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(0, 180, 216, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                  }}>
                    📸
                  </div>
                  <h3 style={{
                    margin: '0 0 8px',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    Upload Garment Image
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                  }}>
                    Click to browse or drag and drop
                  </p>
                  <p style={{
                    marginTop: 8,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-tertiary)',
                  }}>
                    Supports JPG, PNG, WEBP
                  </p>
                </div>
              )}
            </label>

            {/* Action Buttons */}
            {selectedImage && (
              <div style={{
                display: 'flex',
                gap: 12,
                marginTop: 16,
                animation: 'fadeIn 0.3s ease',
              }}>
                <button
                  onClick={handlePredict}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {loading ? (
                    <>
                      <Spinner size={16} />
                      <span style={{ marginLeft: 8 }}>Analyzing...</span>
                    </>
                  ) : (
                    '✨ Predict Price'
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="alert alert-danger"
                style={{ marginTop: 16, animation: 'fadeIn 0.3s ease' }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          {result && (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>
              <h2 style={{
                margin: '0 0 20px',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)',
              }}>
                Prediction Results
              </h2>

              {/* Garment Type */}
              <div className="result-card" style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0, 180, 216, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    👕
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                    }}>
                      Garment Type
                    </div>
                    <div style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textTransform: 'capitalize',
                    }}>
                      {result.garment}
                    </div>
                  </div>
                </div>
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${result.garment_confidence * 100}%` }}
                  />
                </div>
                <div style={{
                  marginTop: 6,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  textAlign: 'right',
                }}>
                  {(result.garment_confidence * 100).toFixed(1)}% confidence
                </div>
              </div>

              {/* Fabric Type */}
              <div className="result-card" style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0, 180, 216, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    🧵
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                    }}>
                      Fabric Type
                    </div>
                    <div style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textTransform: 'capitalize',
                    }}>
                      {result.fabric}
                    </div>
                  </div>
                </div>
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${result.fabric_confidence * 100}%` }}
                  />
                </div>
                <div style={{
                  marginTop: 6,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  textAlign: 'right',
                }}>
                  {(result.fabric_confidence * 100).toFixed(1)}% confidence
                </div>
              </div>

              {/* Price Estimate */}
              <div
                className="result-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.1) 0%, rgba(0, 180, 216, 0.05) 100%)',
                  border: '1px solid var(--cyan-500)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--cyan-500)',
                    color: 'var(--navy-900)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                  }}>
                    ₹
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                    }}>
                      Estimated Price Range
                    </div>
                    <div style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 700,
                      color: 'var(--cyan-400)',
                      fontFamily: 'var(--font-display)',
                    }}>
                      ₹{result.estimated_price_range.min} - ₹{result.estimated_price_range.max}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(0, 180, 216, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(0, 180, 216, 0.2)',
                }}>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}>
                    💡 This is an AI-generated estimate based on garment type and fabric. 
                    Actual prices may vary by shop and location.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        {!result && !selectedImage && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginTop: 32,
          }}>
            <div style={{
              padding: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>🎯</div>
              <h3 style={{
                margin: '0 0 8px',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                Accurate Detection
              </h3>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Our AI model identifies garment types and fabric materials with high accuracy
              </p>
            </div>

            <div style={{
              padding: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⚡</div>
              <h3 style={{
                margin: '0 0 8px',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                Instant Results
              </h3>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Get price estimates in seconds without manual entry
              </p>
            </div>

            <div style={{
              padding: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>💰</div>
              <h3 style={{
                margin: '0 0 8px',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                Smart Pricing
              </h3>
              <p style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Price ranges based on fabric quality and garment complexity
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PredictPrices;