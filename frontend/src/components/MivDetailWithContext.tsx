import React, { useState, useEffect } from "react";
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { ConversationMiv, GetConversationResponse, Contact, Desk } from "../types";
import * as api from "../api/client";
import { uploadPlugin } from "../utils/ckEditorUploadAdapter";
import "./MivDetailWithContext.css";

interface MivDetailWithContextProps {
  miv: ConversationMiv;
  currentDeskId: string;
  currentDesk: Desk;
  onReply: (body: string, isAck?: boolean) => void;
  onForget?: () => void; // Callback when miv is forgotten
}

function MivDetailWithContext({
  miv,
  currentDeskId,
  currentDesk,
  onReply,
  onForget,
}: MivDetailWithContextProps) {
  const [conversation, setConversation] =
    useState<GetConversationResponse | null>(null);
  const [selectedMiv, setSelectedMiv] = useState<ConversationMiv>(miv);
  const [replyBody, setReplyBody] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [showAckConfirm, setShowAckConfirm] = useState(false);
  const [ackBody, setAckBody] = useState("");
  const [showForgetConfirm, setShowForgetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactDeskId, setNewContactDeskId] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [convResponse, contactsResponse] = await Promise.all([
          api.getConversation(miv.conversation_id),
          api.listContacts(currentDeskId),
        ]);
        setConversation(convResponse);
        setContacts(contactsResponse.contacts || []);
        // Find the current miv in the conversation
        const mivArray = convResponse.mivs || [];
        const currentMiv = mivArray.find((m) => m.id === miv.id) || miv;
        setSelectedMiv(currentMiv);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [miv, currentDeskId]);

  const handleMivClick = (clickedMiv: ConversationMiv) => {
    setSelectedMiv(clickedMiv);
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    // Optimistically add the reply to local state
    const optimisticMiv: ConversationMiv = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedMiv.conversation_id,
      seq_no: conversation ? (conversation.mivs || []).length + 1 : 1,
      from: currentDeskId,
      to:
        selectedMiv.from === currentDeskId ? selectedMiv.to : selectedMiv.from,
      subject: selectedMiv.subject,
      body: btoa(replyBody),
      state: "SENT" as any,
      created_at: new Date().toISOString(),
      is_encrypted: false,
      is_ack: false,
      is_forgotten: false,
    };

    // Update conversation immediately
    if (conversation) {
      const currentMivs = conversation.mivs || [];
      setConversation({
        ...conversation,
        mivs: [...currentMivs, optimisticMiv],
      });
    }

    setReplyBody("");
    setShowReply(false);

    // Then sync with server in background
    try {
      await onReply(replyBody, false);
      // Reload conversation to get the real data from server
      const updatedConv = await api.getConversation(
        selectedMiv.conversation_id
      );
      setConversation(updatedConv);
    } catch (err) {
      console.error("Failed to send reply:", err);
      // Revert optimistic update on error
      if (conversation) {
        const currentMivs = conversation.mivs || [];
        setConversation({
          ...conversation,
          mivs: currentMivs.filter((m) => m.id !== optimisticMiv.id),
        });
      }
      alert("Failed to send reply. Please try again.");
    }
  };

  const handleAck = async () => {
    const messageToSend = ackBody.trim() || "ACK - Conversation ended";
    // Optimistically add ACK to local state
    const optimisticAck: ConversationMiv = {
      id: `temp-ack-${Date.now()}`,
      conversation_id: selectedMiv.conversation_id,
      seq_no: conversation ? (conversation.mivs || []).length + 1 : 1,
      from: currentDeskId,
      to:
        selectedMiv.from === currentDeskId ? selectedMiv.to : selectedMiv.from,
      subject: selectedMiv.subject,
      body: btoa(messageToSend),
      state: "SENT" as any,
      created_at: new Date().toISOString(),
      is_encrypted: false,
      is_ack: true,
      is_forgotten: false,
    };

    // Update conversation immediately
    if (conversation) {
      const currentMivs = conversation.mivs || [];
      setConversation({
        ...conversation,
        mivs: [...currentMivs, optimisticAck],
      });
    }

    setShowAckConfirm(false);
    setAckBody("");

    // Then sync with server in background
    try {
      await onReply(messageToSend, true);
      // Reload conversation to get the real data from server
      const updatedConv = await api.getConversation(
        selectedMiv.conversation_id
      );
      setConversation(updatedConv);
    } catch (err) {
      console.error("Failed to send ACK:", err);
      // Revert optimistic update on error
      if (conversation) {
        const currentMivs = conversation.mivs || [];
        setConversation({
          ...conversation,
          mivs: currentMivs.filter((m) => m.id !== optimisticAck.id),
        });
      }
      alert("Failed to send ACK. Please try again.");
    }
  };

  const handleForget = async () => {
    try {
      await api.forgetMiv(selectedMiv.id);
      setShowForgetConfirm(false);
      // Call the callback to refresh the parent view
      if (onForget) {
        onForget();
      }
      alert("Message forgotten. It will no longer appear in your SENT basket.");
    } catch (err) {
      console.error("Failed to forget miv:", err);
      alert("Failed to forget message. Please try again.");
    }
  };

  const handleDelete = async () => {
    try {
      await api.archiveConversation(selectedMiv.conversation_id);
      setShowDeleteConfirm(false);
      // Call the callback to refresh the parent view
      if (onForget) {
        onForget();
      }
      alert("Conversation archived successfully.");
    } catch (err) {
      console.error("Failed to archive conversation:", err);
      alert("Failed to archive conversation. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatPhoneId = (id: string) => {
    if (id.length === 10) {
      return `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6)}`;
    }
    return id;
  };

  const getDisplayName = (deskIdRef: string) => {
    const contact = contacts.find((c) => c.desk_id_ref === deskIdRef);
    const formattedId = formatPhoneId(deskIdRef);
    if (contact) {
      return `${contact.name} @ ${formattedId}`;
    }
    return formattedId;
  };

  const isContact = (deskIdRef: string) => {
    return contacts.some((c) => c.desk_id_ref === deskIdRef);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactDeskId) return;

    try {
      await api.createContact(currentDeskId, {
        name: newContactName.trim(),
        desk_id_ref: newContactDeskId,
        notes: "",
      });

      // Reload contacts
      const contactsResponse = await api.listContacts(currentDeskId);
      setContacts(contactsResponse.contacts || []);

      // Close modal
      setShowAddContactModal(false);
      setNewContactName("");
      setNewContactDeskId("");
    } catch (err) {
      console.error("Failed to add contact:", err);
      alert("Failed to add contact. Please try again.");
    }
  };

  const openAddContactModal = (deskIdRef: string) => {
    setNewContactDeskId(deskIdRef);
    setNewContactName("");
    setShowAddContactModal(true);
  };

  if (loading || !conversation) {
    return (
      <div className="miv-detail-with-context">
        <div className="loading">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="miv-detail-with-context">
      {/* Conversation thread icons */}
      <div className="thread-context">
        <div className="thread-header">
          <h3>Conversation Thread</h3>
          <span className="thread-count">
            {(conversation.mivs || []).length} messages
          </span>
        </div>
        <div className="thread-icons">
          {(conversation.mivs || []).map((m, index) => (
            <div
              key={m.id}
              className={`thread-icon ${
                m.id === selectedMiv.id ? "active" : ""
              } ${m.from === currentDeskId ? "outgoing" : "incoming"}`}
              onClick={() => handleMivClick(m)}
              title={`Message #${m.seq_no} - ${
                m.from === currentDeskId ? "You" : formatPhoneId(m.from)
              }`}
            >
              <span className="icon-number">{m.seq_no}</span>
              <span className="icon-direction">
                {m.from === currentDeskId ? "→" : "←"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected miv detail */}
      <div className="miv-detail-content">
        <div className="epistle-document">
          {/* Epistle-style header with formal layout */}
          <div className="epistle-header">
            <div className="epistle-header-left">
              <div className="epistle-field">
                <span className="epistle-field-label">To:</span>
                <span className="epistle-field-value">
                  {getDisplayName(selectedMiv.to)}
                </span>
                {!isContact(selectedMiv.to) && (
                  <button
                    className="btn-add-contact-inline"
                    onClick={() => openAddContactModal(selectedMiv.to)}
                    title="Add as contact"
                  >
                    + Add Contact
                  </button>
                )}
              </div>
              <div className="epistle-field">
                <span className="epistle-field-label">From:</span>
                <span className="epistle-field-value">
                  {getDisplayName(selectedMiv.from)}
                </span>
                {!isContact(selectedMiv.from) && (
                  <button
                    className="btn-add-contact-inline"
                    onClick={() => openAddContactModal(selectedMiv.from)}
                    title="Add as contact"
                  >
                    + Add Contact
                  </button>
                )}
              </div>
            </div>
            <div className="epistle-header-right">
              <div className="epistle-field">
                <span className="epistle-field-value">
                  {formatDate(selectedMiv.created_at)}
                </span>
              </div>
              <div className="epistle-field epistle-sequence">
                <span className="epistle-field-value">
                  Message #{selectedMiv.seq_no}
                </span>
              </div>
            </div>
          </div>

          {/* Centered subject */}
          <div className="epistle-subject">
            <h2>{selectedMiv.subject}</h2>
          </div>

          {/* Body content */}
          <div 
            className="epistle-body"
            style={{
              fontFamily: currentDesk?.font_family || 'Georgia, serif',
              fontSize: currentDesk?.font_size || '14px'
            }}
          >
            {selectedMiv.is_ack && <span className="ack-badge">[ACK] </span>}
            <div 
              className={`epistle-content ${currentDesk?.auto_indent ? 'auto-indent' : ''}`}
              dangerouslySetInnerHTML={{ __html: atob(selectedMiv.body) }} 
            />
          </div>
        </div>

        <div className="miv-actions">
          {selectedMiv.to === currentDeskId &&
            !showReply &&
            !showAckConfirm &&
            !showForgetConfirm &&
            !showDeleteConfirm && (
              <>
                {selectedMiv.is_ack ? (
                  // For ACK mivs, show "Answer" and "Delete" buttons
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowReply(true)}
                    >
                      Answer
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  // For non-ACK mivs, show "Reply" and "Send ACK" buttons
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowReply(true)}
                    >
                      Reply
                    </button>
                    <button
                      className="btn btn-ack"
                      onClick={() => setShowAckConfirm(true)}
                    >
                      Send ACK
                    </button>
                  </>
                )}
              </>
            )}

          {/* Add forget button for sent messages */}
          {selectedMiv.from === currentDeskId &&
            !selectedMiv.is_forgotten &&
            selectedMiv.state === "SENT" &&
            !showForgetConfirm && (
              <button
                className="btn btn-forget"
                onClick={() => setShowForgetConfirm(true)}
                title="Stop tracking replies for this message"
              >
                Forget
              </button>
            )}

          {selectedMiv.is_forgotten && (
            <span className="forgotten-label">
              This message has been forgotten
            </span>
          )}
        </div>

        {showForgetConfirm && (
          <div className="forget-confirm">
            <p>
              Are you sure you want to forget this message? It will be removed
              from your SENT basket and you will no longer track replies to it.
            </p>
            <div className="forget-actions">
              <button onClick={handleForget} className="btn btn-danger">
                Yes, Forget This Message
              </button>
              <button
                onClick={() => setShowForgetConfirm(false)}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="delete-confirm">
            <p>
              Are you sure you want to delete this conversation? The
              conversation will be archived and removed from your inbox.
            </p>
            <div className="delete-actions">
              <button onClick={handleDelete} className="btn btn-danger">
                Yes, Archive This Conversation
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showAckConfirm && (
          <div className="ack-confirm">
            <h3>Send Acknowledgment</h3>
            <p>
              Send an acknowledgment message? The recipient can reply to
              continue the conversation or delete it to end.
            </p>
            <textarea
              className="ack-body"
              value={ackBody}
              onChange={(e) => setAckBody(e.target.value)}
              placeholder="Optional: Type your acknowledgment message..."
              rows={4}
            />
            <div className="ack-actions">
              <button onClick={handleAck} className="btn btn-danger">
                Yes, Send ACK
              </button>
              <button
                onClick={() => {
                  setShowAckConfirm(false);
                  setAckBody("");
                }}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showReply && (
          <form onSubmit={handleReplySubmit} className="reply-form">
            <h3>Reply</h3>
            <div className="editor-container">
              <CKEditor
                editor={ClassicEditor as any}
                config={{
                  extraPlugins: [uploadPlugin],
                  toolbar: {
                    items: [
                      'undo', 'redo', '|',
                      'heading', '|',
                      'bold', 'italic', 'underline', 'strikethrough', '|',
                      'code', 'subscript', 'superscript', '|',
                      'link', 'insertTable', 'imageUpload', 'mediaEmbed', '|',
                      'bulletedList', 'numberedList', '|',
                      'blockQuote', 'horizontalLine'
                    ]
                  },
                  image: {
                    toolbar: [
                      'imageStyle:alignLeft',
                      'imageStyle:alignCenter',
                      'imageStyle:alignRight',
                      '|',
                      'resizeImage'
                    ]
                  },
                  heading: {
                    options: [
                      { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                      { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                      { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                      { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
                    ]
                  },
                  placeholder: 'Write your reply...'
                } as any}
                data={replyBody}
                onChange={(event, editor) => {
                  const data = editor.getData();
                  setReplyBody(data);
                }}
              />
            </div>
            <div className="reply-actions">
              <button type="submit" className="btn btn-primary">
                Send Reply
              </button>
              {!selectedMiv.is_ack && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setShowReply(false);
                    setShowAckConfirm(true);
                  }}
                >
                  Send ACK
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowReply(false);
                  setReplyBody("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div
          className="add-contact-modal-overlay"
          onClick={() => setShowAddContactModal(false)}
        >
          <div
            className="add-contact-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add New Contact</h3>
            <form onSubmit={handleAddContact}>
              <div className="modal-form-group">
                <label htmlFor="contactName">Name</label>
                <input
                  id="contactName"
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Enter contact name"
                  autoFocus
                  required
                />
              </div>
              <div className="modal-form-group">
                <label htmlFor="contactDeskId">Desk ID</label>
                <input
                  id="contactDeskId"
                  type="text"
                  value={formatPhoneId(newContactDeskId)}
                  disabled
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MivDetailWithContext;
