import axios from 'axios';

// Instantiate default Axios client mapping to relative routes (handled by Vite's dev proxy)
const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Service Health Status check
  checkHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Multi-PDF upload with standard event hook for upload progress indicators
  uploadFiles: async (files, onProgress) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // Get active uploaded files lists
  getUploadedDocs: async () => {
    const response = await api.get('/uploads');
    return response.data;
  },

  // Purge document database and indexes
  clearUploadedDocs: async () => {
    const response = await api.delete('/uploads');
    return response.data;
  },

  // Delete a single document by filename
  deleteDocument: async (filename) => {
    const response = await api.delete(`/uploads/${filename}`);
    return response.data;
  },

  // Request Document summary structures
  generateSummary: async (filename = null) => {
    const response = await api.post('/summary', { filename });
    return response.data;
  },

  // Request Document extra features (definitions, glosaries, timelines, faqs)
  generateQuestions: async (filename = null) => {
    const response = await api.post('/questions', { filename });
    return response.data;
  },

  // Retrieve list of past chat sessions
  getSessions: async () => {
    const response = await api.get('/history');
    return response.data;
  },

  // Fetch full conversation history log of a single session
  getSessionHistory: async (sessionId) => {
    const response = await api.get(`/history/${sessionId}`);
    return response.data;
  },

  // Delete all conversations history
  clearAllHistory: async () => {
    const response = await api.delete('/history');
    return response.data;
  },

  // Clear specific conversation session log
  clearSessionHistory: async (sessionId) => {
    const response = await api.delete(`/history?session_id=${sessionId}`);
    return response.data;
  },

  // Stream chatbot response token-by-token using Fetch and ReadableStreams reader.
  // This allows processing of server-sent event (SSE) channels.
  streamChat: async ({
    question,
    sessionId,
    searchType = 'mmr',
    filterFilename = null,
    onChunk,
    onCitations,
    onError,
    onDone,
  }) => {
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          session_id: sessionId,
          search_type: searchType,
          filter_filename: filterFilename,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      // Read custom HTTP header to grab a new generated Session ID if applicable
      const returnedSessionId = response.headers.get('X-Session-ID');

      if (!response.body) {
        throw new Error('ReadableStream is not supported by the client browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Hold back final incomplete line
        buffer = lines.pop() || '';

        let currentEvent = '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.split('event:')[1].trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.split('data:')[1].trim();
            
            if (currentEvent === 'citations' && onCitations) {
              const citations = JSON.parse(dataStr);
              onCitations(citations);
            } else if (currentEvent === 'message' && onChunk) {
              const token = JSON.parse(dataStr);
              onChunk(token);
            } else if (currentEvent === 'error' && onError) {
              const errorMsg = JSON.parse(dataStr);
              onError(errorMsg);
            } else if (currentEvent === 'done') {
              if (onDone) onDone(returnedSessionId || sessionId);
            }
          }
        }
      }
    } catch (err) {
      if (onError) onError(err.message || 'Unknown network error occurred.');
    }
  },
};
