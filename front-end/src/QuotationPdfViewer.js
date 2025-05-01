import React, { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';

const QuotationPdfViewer = ({ quotationId, apiBaseUrl = '/api' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfOptions, setPdfOptions] = useState({
    filename: 'quotation.pdf',
    format: 'a4',
    orientation: 'portrait',
    margin: 10
  });
  const [showOptions, setShowOptions] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    // Set iframe title for accessibility
    if (iframeRef.current) {
      iframeRef.current.title = 'Quotation Preview';
    }
  }, []);

  const handleDownloadPdf = () => {
    setLoading(true);
    
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const element = iframeRef.current.contentWindow.document.body;
        
        const options = {
          margin: pdfOptions.margin,
          filename: pdfOptions.filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { 
            unit: 'mm', 
            format: pdfOptions.format, 
            orientation: pdfOptions.orientation 
          }
        };
        
        html2pdf()
          .from(element)
          .set(options)
          .save()
          .then(() => setLoading(false))
          .catch(err => {
            console.error('Failed to generate PDF:', err);
            setError('Failed to generate PDF. Please try again.');
            setLoading(false);
          });
      } else {
        setError('Cannot access iframe content');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error in PDF generation:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleOptionChange = (e) => {
    const { name, value } = e.target;
    setPdfOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="quotation-viewer">
      <div className="toolbar">
        <h2>Quotation Preview</h2>
        <div className="buttons">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="btn-options"
          >
            {showOptions ? 'Hide Options' : 'Show Options'}
          </button>
          <button 
            onClick={handleDownloadPdf}
            disabled={loading}
            className="btn-download"
          >
            {loading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      {showOptions && (
        <div className="options-panel">
          <div className="option-group">
            <label htmlFor="filename">Filename:</label>
            <input
              type="text"
              id="filename"
              name="filename"
              value={pdfOptions.filename}
              onChange={handleOptionChange}
            />
          </div>
          
          <div className="option-group">
            <label htmlFor="format">Paper Size:</label>
            <select
              id="format"
              name="format"
              value={pdfOptions.format}
              onChange={handleOptionChange}
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
            </select>
          </div>
          
          <div className="option-group">
            <label htmlFor="orientation">Orientation:</label>
            <select
              id="orientation"
              name="orientation"
              value={pdfOptions.orientation}
              onChange={handleOptionChange}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          
          <div className="option-group">
            <label htmlFor="margin">Margin (mm):</label>
            <input
              type="number"
              id="margin"
              name="margin"
              min="0"
              max="50"
              value={pdfOptions.margin}
              onChange={handleOptionChange}
            />
          </div>
        </div>
      )}
      
      <div className="preview-container">
        {loading && <div className="loading-overlay">Loading preview...</div>}
        <iframe
          ref={iframeRef}
          src={`${apiBaseUrl}/quotations/${quotationId}/preview`}
          className="preview-iframe"
          onLoad={() => setLoading(false)}
          frameBorder="0"
        />
      </div>
      
      <style jsx>{`
        .quotation-viewer {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%; 
          max-width: 900px;
          margin: 0 auto;
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          background-color: #f5f5f5;
          border-bottom: 1px solid #e1e1e1;
        }
        
        .buttons {
          display: flex;
          gap: 10px;
        }
        
        .btn-options, .btn-download {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        
        .btn-options {
          background-color: #f0f0f0;
          color: #333;
        }
        
        .btn-download {
          background-color: #4CAF50;
          color: white;
        }
        
        .btn-options:hover {
          background-color: #e0e0e0;
        }
        
        .btn-download:hover {
          background-color: #45a049;
        }
        
        .options-panel {
          padding: 15px;
          background-color: #f9f9f9;
          border-bottom: 1px solid #e1e1e1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .option-group {
          display: flex;
          flex-direction: column;
        }
        
        .option-group label {
          margin-bottom: 5px;
          font-size: 14px;
          color: #555;
        }
        
        .option-group input, .option-group select {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .preview-container {
          position: relative;
          flex: 1;
          min-height: 500px;
        }
        
        .preview-iframe {
          width: 100%;
          height: 100%;
          min-height: 500px;
          border: none;
        }
        
        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255,255,255,0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10;
        }
        
        .error-message {
          padding: 10px 15px;
          background-color: #ffebee;
          color: #c62828;
          border-bottom: 1px solid #ef9a9a;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .error-message button {
          background: none;
          border: none;
          color: #c62828;
          font-weight: bold;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default QuotationPdfViewer;