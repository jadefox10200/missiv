import React, { useState, useEffect } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { ImageResize } from "@ckeditor/ckeditor5-image";
import { CreateMivRequest, Contact, Desk } from "../types";
import * as api from "../api/client";
import { uploadPlugin } from "../utils/ckEditorUploadAdapter";
import { buildMessageWithTemplate } from "../utils/messageTemplate";
import "./ComposeMiv.css";

interface ComposeMivProps {
  onSend: (request: CreateMivRequest) => Promise<void>;
  onCancel: () => void;
  deskId: string;
  desk: Desk;
}

const ComposeMiv: React.FC<ComposeMivProps> = ({
  onSend,
  onCancel,
  deskId,
  desk,
}) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [templateInitialized, setTemplateInitialized] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await api.listContacts(deskId);
        setContacts(response.contacts || []);
      } catch (err) {
        console.error("Failed to load contacts:", err);
      }
    };

    loadContacts();
  }, [deskId]);

  // Auto-insert salutation and signature when recipient is selected
  useEffect(() => {
    if (to && contacts.length > 0 && !templateInitialized) {
      const initialTemplate = buildMessageWithTemplate(
        desk.default_salutation || '',
        to,
        contacts,
        desk.default_closure || '',
        '<p><br></p>' // Empty paragraph for typing
      );
      setBody(initialTemplate);
      setTemplateInitialized(true);
    }
  }, [to, contacts, desk.default_salutation, desk.default_closure, templateInitialized]);

  // Reset template flag when recipient changes
  useEffect(() => {
    setTemplateInitialized(false);
  }, [to]);

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
      contact.desk_id_ref.includes(contactSearchTerm.replace(/\D/g, ""))
  );

  const selectContact = (contact: Contact) => {
    setTo(contact.desk_id_ref);
    setContactSearchTerm(contact.name);
    setShowContactDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!to || !subject || !body) {
      setError("All fields are required");
      return;
    }

    // Validate phone-style ID (10 digits)
    if (!/^\d{10}$/.test(to)) {
      setError("Recipient ID must be a 10-digit number");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await onSend({ to, subject, body });
      // Reset form on success
      setTo("");
      setSubject("");
      setBody("");
      setTemplateInitialized(false);
      setContactSearchTerm("");
    } catch (err) {
      setError("Failed to send miv. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const formatPhoneId = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, "");

    // Format as XXXX-XX-XXXX
    if (digits.length <= 4) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(
        6,
        10
      )}`;
    }
  };

  const handleContactSearchChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setContactSearchTerm(e.target.value);
    setShowContactDropdown(true);
    // If typing a phone number, also set the 'to' field
    const digits = e.target.value.replace(/\D/g, "");
    if (digits) {
      setTo(digits.slice(0, 10));
    } else {
      setTo("");
    }
  };

  const getRecipientDisplay = () => {
    if (contactSearchTerm) {
      return contactSearchTerm;
    }
    if (to) {
      // Check if this desk ID matches a contact
      const contact = contacts.find((c) => c.desk_id_ref === to);
      if (contact) {
        return contact.name;
      }
      return formatPhoneId(to);
    }
    return "";
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
          <div className="recipient-input-container">
            <input
              id="to"
              type="text"
              value={getRecipientDisplay()}
              onChange={handleContactSearchChange}
              onFocus={() => setShowContactDropdown(true)}
              onBlur={() =>
                setTimeout(() => setShowContactDropdown(false), 200)
              }
              placeholder="Search contacts or enter 5551-23-4567"
              disabled={isSending}
              autoComplete="off"
            />
            {showContactDropdown && filteredContacts.length > 0 && (
              <div className="contact-dropdown">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="contact-dropdown-item"
                    onClick={() => selectContact(contact)}
                  >
                    <div className="contact-dropdown-name">{contact.name}</div>
                    <div className="contact-dropdown-id">
                      {formatPhoneId(contact.desk_id_ref)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="help-text">
            {to && contactSearchTerm && `mivID: ${formatPhoneId(to)}`}
            {to && !contactSearchTerm && `Sending to: ${formatPhoneId(to)}`}
            {!to && "Search for a contact or enter a 10-digit ID"}
          </span>
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
          <div className="editor-container">
            <CKEditor
              editor={ClassicEditor as any}
              config={{
                extraPlugins: [uploadPlugin, ImageResize],
                toolbar: {
                  items: [
                    "undo",
                    "redo",
                    "|",
                    "heading",
                    "|",
                    "bold",
                    "italic",
                    "underline",
                    "strikethrough",
                    "|",
                    "code",
                    "subscript",
                    "superscript",
                    "|",
                    "link",
                    "insertTable",
                    "imageUpload",
                    "mediaEmbed",
                    "|",
                    "bulletedList",
                    "numberedList",
                    "|",
                    "blockQuote",
                    "horizontalLine",
                  ],
                },
                image: {
                  toolbar: [
                    "imageStyle:alignLeft",
                    "imageStyle:alignCenter",
                    "imageStyle:alignRight",
                    "|",
                    "resizeImage",
                  ],
                },
                heading: {
                  options: [
                    {
                      model: "paragraph",
                      title: "Paragraph",
                      class: "ck-heading_paragraph",
                    },
                    {
                      model: "heading1",
                      view: "h1",
                      title: "Heading 1",
                      class: "ck-heading_heading1",
                    },
                    {
                      model: "heading2",
                      view: "h2",
                      title: "Heading 2",
                      class: "ck-heading_heading2",
                    },
                    {
                      model: "heading3",
                      view: "h3",
                      title: "Heading 3",
                      class: "ck-heading_heading3",
                    },
                  ],
                },
                placeholder: "Enter your message...",
              } as any}
              data={body}
              disabled={isSending}
              onChange={(event, editor) => {
                const data = editor.getData();
                setBody(data);
              }}
            />
          </div>
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
            type="button"
            onClick={() => setShowPreview(true)}
            className="btn btn-preview"
            disabled={isSending || !body}
          >
            👁️ Preview
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSending}
          >
            {isSending ? "Sending..." : "Send Miv"}
          </button>
        </div>
      </form>

      {showPreview && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>Message Preview</h3>
              <button
                className="close-button"
                onClick={() => setShowPreview(false)}
              >
                ×
              </button>
            </div>
            <div className="preview-content">
              <div
                className="epistle-preview"
                style={{
                  fontFamily: desk?.font_family || "Georgia, serif",
                  fontSize: desk?.font_size || "14px",
                }}
              >
                <div className="preview-subject">
                  <h2>{subject || "(No subject)"}</h2>
                </div>
                <div
                  className={`preview-body ${
                    desk?.auto_indent ? "auto-indent" : ""
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: body || "<p>(No message)</p>",
                  }}
                />
              </div>
            </div>
            <div className="preview-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowPreview(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposeMiv;
