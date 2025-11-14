import React, { useState } from 'react';
import { CreateMivRequest } from '../types';
import './ComposeMiv.css';

interface ComposeMivProps {
  onSend: (request: CreateMivRequest) => Promise<void>;
  onCancel: () => void;
}

const ComposeMiv: React.FC<ComposeMivProps> = ({ onSend, onCancel }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!to || !subject || !body) {
      setError('All fields are required');
      return;
    }

    // Validate phone-style ID (10 digits)
    if (!/^\d{10}$/.test(to)) {
      setError('Recipient ID must be a 10-digit number');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await onSend({ to, subject, body });
      // Reset form on success
      setTo('');
      setSubject('');
      setBody('');
    } catch (err) {
      setError('Failed to send miv. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const formatPhoneId = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setTo(value);
  };

  return (
    <div className="compose-miv">
      <div className="compose-header">
        <h2>Compose New Miv</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="compose-form">
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="to">To:</label>
          <input
            id="to"
            type="text"
            value={formatPhoneId(to)}
            onChange={handleToChange}
            placeholder="(555) 123-4567"
            disabled={isSending}
          />
          <span className="help-text">Enter recipient's 10-digit ID</span>
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject:</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject"
            disabled={isSending}
          />
        </div>

        <div className="form-group">
          <label htmlFor="body">Message:</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter your message"
            rows={10}
            disabled={isSending}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Send Miv'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ComposeMiv;
