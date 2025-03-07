import React, { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Shield, FileText, Info } from 'lucide-react';
import './DocumentVerificationModal.css';

const DocumentVerificationModal = ({ isOpen, onClose, onVerificationComplete }) => {
  const [document, setDocument] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset states
    setError('');
    
    // Simple validation
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Accept only common document formats
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or image file (JPEG, PNG)');
      return;
    }

    setDocument(file);
    setFileName(file.name);
  };

  const handleTermsChange = (e) => {
    setTermsAccepted(e.target.checked);
    if (e.target.checked) {
      setTermsError(false);
    }
  };

  const handleVerification = async () => {
    if (!document) {
      setError('Please upload a document for verification');
      return;
    }

    if (!termsAccepted) {
      setTermsError(true);
      return;
    }

    setIsUploading(true);
    
    // Simulate processing delay (1.5 seconds) - in a real app this would be an actual API call
    setTimeout(() => {
      setIsUploading(false);
      // Always succeed for this student project
      onVerificationComplete(true);
    }, 1500);
  };

  return (
    <div className="modal-overlay">
      <div className="verification-modal">
        <div className="modal-header">
          <div className="header-title">
            <Shield size={24} className="shield-icon" />
            <h2>Address Verification</h2>
          </div>
          <button 
            className="close-modal" 
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="verification-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Upload a document</h3>
                <p>We accept utility bills, bank statements, or official government documents</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Confirm your details</h3>
                <p>Make sure the document displays your full name and address</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Verified in seconds</h3>
                <p>Your document will be automatically verified and your listing will be published</p>
              </div>
            </div>
          </div>

          <div className="document-section">
            <h3>Upload Verification Document</h3>
            <p className="verification-info">
              Please upload a document that verifies your address. This helps us maintain
              platform security and build trust within our community.
            </p>

            <div className={`upload-container verification ${isUploading ? 'disabled' : ''}`}>
              <input
                type="file"
                onChange={handleFileChange}
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={isUploading}
                id="document-upload"
              />
              <label htmlFor="document-upload" className="upload-label">
                <div className="upload-text">
                  <Upload size={28} className="upload-icon" />
                  <span>{document ? 'Change document' : 'Upload verification document'}</span>
                  <span className="file-types">PDF, JPEG, or PNG (max 5MB)</span>
                </div>
              </label>
            </div>

            {fileName && (
              <div className="document-preview">
                <FileText size={20} className="document-icon" />
                <div className="document-info">
                  <span className="document-name">{fileName}</span>
                  <span className="document-status">Ready to verify</span>
                </div>
                <CheckCircle size={20} className="status-icon" />
              </div>
            )}

            {error && (
              <div className="verification-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="terms-section">
            <label className={`terms-checkbox ${termsError ? 'terms-error' : ''}`}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={handleTermsChange}
                disabled={isUploading}
              />
              <span>
                I agree that my address information may be used for verification purposes and
                I confirm this document contains my current address information.
              </span>
            </label>
            {termsError && (
              <p className="terms-error-message">
                <Info size={14} /> Please accept the terms to continue
              </p>
            )}
          </div>

          <div className="privacy-note">
            <p>
              <strong>Privacy Note:</strong> For this student project, documents are not
              actually stored or processed. In a real application, your documents would be
              securely stored and handled according to privacy regulations.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button 
            className={`verify-button ${document && termsAccepted ? 'active' : ''}`}
            onClick={handleVerification}
            disabled={!document || !termsAccepted || isUploading}
          >
            {isUploading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              'Verify & Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerificationModal;