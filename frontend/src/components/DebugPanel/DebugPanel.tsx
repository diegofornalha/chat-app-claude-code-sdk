import React, { useState, useEffect } from 'react';

interface DebugPanelProps {
  sessionId?: string;
  isVisible: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ sessionId, isVisible, onClose }) => {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'session' | 'dialogs' | 'context'>('session');

  useEffect(() => {
    if (isVisible && sessionId) {
      fetchDebugData();
    }
  }, [isVisible, sessionId, activeTab]);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'session' && sessionId) {
        endpoint = `http://localhost:8080/api/debug/session/${sessionId}`;
      } else if (activeTab === 'dialogs') {
        endpoint = 'http://localhost:8080/api/debug/dialogs';
      }

      if (endpoint) {
        const response = await fetch(endpoint);
        const data = await response.json();
        setDebugData(data);
      }
    } catch (error) {
      console.error('Error fetching debug data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '400px',
      backgroundColor: '#1a1a1a',
      color: '#fff',
      borderTop: '2px solid #4CAF50',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#2a2a2a',
        borderBottom: '1px solid #444'
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <h3 style={{ margin: 0 }}>🔍 Debug Panel</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setActiveTab('session')}
              style={{
                padding: '5px 10px',
                backgroundColor: activeTab === 'session' ? '#4CAF50' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Session Context
            </button>
            <button
              onClick={() => setActiveTab('dialogs')}
              style={{
                padding: '5px 10px',
                backgroundColor: activeTab === 'dialogs' ? '#4CAF50' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              All Dialogs
            </button>
            <button
              onClick={() => setActiveTab('context')}
              style={{
                padding: '5px 10px',
                backgroundColor: activeTab === 'context' ? '#4CAF50' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Context Preview
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '5px 10px',
            backgroundColor: '#f44336',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '10px',
        backgroundColor: '#0a0a0a'
      }}>
        {loading && <div>Loading...</div>}
        
        {!loading && debugData && activeTab === 'session' && (
          <div>
            <h4 style={{ color: '#4CAF50' }}>📊 Session Info</h4>
            <pre style={{ color: '#aaa' }}>
              Session ID: {debugData.sessionId}
              Exists: {debugData.exists ? '✅' : '❌'}
              Message Count: {debugData.messageCount}
              Neo4j Connected: {debugData.neo4j?.connected ? '✅' : '❌'}
              Messages in Graph: {debugData.neo4j?.messagesInGraph || 0}
            </pre>

            <h4 style={{ color: '#4CAF50' }}>💬 Recent Messages</h4>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {debugData.messages?.map((msg: any, idx: number) => (
                <div key={idx} style={{
                  padding: '5px',
                  marginBottom: '5px',
                  backgroundColor: msg.type === 'user' ? '#1a3a1a' : '#1a1a3a',
                  borderRadius: '3px'
                }}>
                  <strong>{msg.type === 'user' ? '👤' : '🤖'} {msg.type}</strong>
                  <div style={{ color: '#888', fontSize: '10px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <div>{msg.content?.substring(0, 200)}...</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && debugData && activeTab === 'dialogs' && (
          <div>
            <h4 style={{ color: '#4CAF50' }}>🗂️ Active Dialogs: {debugData.activeDialogs}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
              {debugData.dialogs?.map((dialog: any) => (
                <div key={dialog.sessionId} style={{
                  padding: '10px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '5px'
                }}>
                  <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                    {dialog.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    ID: {dialog.sessionId.substring(0, 8)}...
                  </div>
                  <div style={{ marginTop: '5px' }}>
                    Messages: {dialog.messageCount}
                  </div>
                  {dialog.lastMessage && (
                    <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#0a0a0a', borderRadius: '3px' }}>
                      <div style={{ fontSize: '10px', color: '#666' }}>Last message:</div>
                      <div style={{ fontSize: '11px' }}>{dialog.lastMessage.preview}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && debugData && activeTab === 'context' && (
          <div>
            <h4 style={{ color: '#4CAF50' }}>📝 Context Preview (What Claude Sees)</h4>
            <pre style={{
              backgroundColor: '#0a0a0a',
              padding: '10px',
              borderRadius: '5px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              color: '#aaa',
              border: '1px solid #333'
            }}>
              {debugData.contextPreview || 'No context available'}
            </pre>
            
            <h4 style={{ color: '#4CAF50' }}>📊 Stats</h4>
            <pre style={{ color: '#aaa' }}>
              {JSON.stringify(debugData.stats, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;