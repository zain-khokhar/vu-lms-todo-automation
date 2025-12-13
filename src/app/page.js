'use client';

import { useState } from 'react';

export default function Home() {
  const [students, setStudents] = useState([]);
  const [currentForm, setCurrentForm] = useState({
    username: '',
    password: '',
    whatsapp: ''
  });
  const [processing, setProcessing] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [results, setResults] = useState([]);

  // Add student to the list
  const addStudent = (e) => {
    e.preventDefault();
    
    if (!currentForm.username || !currentForm.password || !currentForm.whatsapp) {
      alert('Please fill in all fields');
      return;
    }

    setStudents([...students, { ...currentForm }]);
    setCurrentForm({ username: '', password: '', whatsapp: '' });
  };

  // Remove student from list
  const removeStudent = (index) => {
    setStudents(students.filter((_, i) => i !== index));
  };

  // Start processing
  const startProcessing = async () => {
    if (students.length === 0) {
      alert('Please add at least one student');
      return;
    }

    setProcessing(true);
    setResults([]);
    setCurrentStudent(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ students })
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
      } else {
        alert(`Error: ${data.error}`);
        setResults(data.results || []);
      }
    } catch (error) {
      alert(`Fatal error: ${error.message}`);
    } finally {
      setProcessing(false);
      setCurrentStudent(null);
      setCountdown(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            VU LMS To-Do Automation
          </h1>
          <p className="text-zinc-400">Automated activity scraping for multiple students</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Input Section */}
          <div className="space-y-6">
            {/* Add Student Form */}
            <div className="bg-zinc-800/50 backdrop-blur border border-zinc-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Add Student
              </h2>
              
              <form onSubmit={addStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    LMS Username
                  </label>
                  <input
                    type="text"
                    value={currentForm.username}
                    onChange={(e) => setCurrentForm({ ...currentForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="e.g., BC123456789"
                    disabled={processing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    LMS Password
                  </label>
                  <input
                    type="password"
                    value={currentForm.password}
                    onChange={(e) => setCurrentForm({ ...currentForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="••••••••"
                    disabled={processing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={currentForm.whatsapp}
                    onChange={(e) => setCurrentForm({ ...currentForm, whatsapp: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="e.g., +923001234567"
                    disabled={processing}
                  />
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Queue
                </button>
              </form>
            </div>

            {/* Student List */}
            <div className="bg-zinc-800/50 backdrop-blur border border-zinc-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Student Queue ({students.length})
              </h2>

              {students.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No students added yet</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {students.map((student, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-lg border border-zinc-700"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{student.username}</p>
                        <p className="text-sm text-zinc-400">{student.whatsapp}</p>
                      </div>
                      <button
                        onClick={() => removeStudent(index)}
                        disabled={processing}
                        className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {students.length > 0 && (
                <button
                  onClick={startProcessing}
                  disabled={processing}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span>▶</span>
                      Start Processing
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Column - Results Section */}
          <div className="space-y-6">
            {/* Processing Status */}
            {processing && (
              <div className="bg-blue-900/30 backdrop-blur border border-blue-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  Currently Processing
                </h2>
                <div className="text-center py-4">
                  <div className="animate-pulse text-blue-400 text-lg mb-2">
                    Processing students...
                  </div>
                  <p className="text-zinc-400 text-sm">
                    This may take several minutes
                  </p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {results.length > 0 && (
              <div className="bg-zinc-800/50 backdrop-blur border border-zinc-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Results ({results.length})
                </h2>

                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        result.status === 'success'
                          ? 'bg-green-900/20 border-green-700'
                          : 'bg-red-900/20 border-red-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-lg">{result.student}</p>
                          <p className="text-sm text-zinc-400">{result.whatsapp}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            result.status === 'success'
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {result.status}
                        </span>
                      </div>

                      {result.error && (
                        <div className="mb-3 p-3 bg-red-950/50 border border-red-800 rounded text-sm text-red-300">
                          ❌ {result.error}
                        </div>
                      )}

                      {result.activities && result.activities.length > 0 ? (
                        <div>
                          <p className="text-sm text-zinc-400 mb-2">
                            {result.activities.length} activities found
                          </p>
                          
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-blue-400 hover:text-blue-300 transition">
                              View JSON Output
                            </summary>
                            <pre className="mt-2 p-3 bg-zinc-950 rounded text-xs overflow-x-auto border border-zinc-700">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </details>

                          {/* Activity List */}
                          <div className="mt-3 space-y-2">
                            {result.activities.slice(0, 3).map((activity, idx) => (
                              <div key={idx} className="p-2 bg-zinc-900/50 rounded text-xs border border-zinc-700">
                                <p className="font-medium text-white">{activity.course_code} - {activity.activity_type}</p>
                                <p className="text-zinc-400">{activity.title}</p>
                                {activity.due_date && (
                                  <p className="text-zinc-500">Due: {activity.due_date}</p>
                                )}
                              </div>
                            ))}
                            {result.activities.length > 3 && (
                              <p className="text-xs text-zinc-500 text-center">
                                ...and {result.activities.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        result.status === 'success' && (
                          <p className="text-sm text-zinc-500">No activities found</p>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
