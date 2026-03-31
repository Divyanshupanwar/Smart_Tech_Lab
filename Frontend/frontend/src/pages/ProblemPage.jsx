import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useParams, NavLink } from 'react-router';
import axiosClient from "../utils/axiosClient"
import SubmissionHistory from "../components/SubmissionHistory"
import ChatAi from '../components/ChatAi';
import Editorial from '../components/Editorial';
import { ArrowLeft, Play, Send, CheckCircle2, XCircle, Code } from 'lucide-react';

const langMap = {
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript'
};

const extractProblem = (payload) => payload?.problem || payload;

const ProblemPage = () => {
  const [problem, setProblem] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [activeLeftTab, setActiveLeftTab] = useState('description');
  const [activeRightTab, setActiveRightTab] = useState('code');
  const [pageError, setPageError] = useState(null);
  const editorRef = useRef(null);
  let { problemId } = useParams();

  useEffect(() => {
    const fetchProblem = async () => {
      setPageLoading(true);
      setPageError(null);
      try {
        const response = await axiosClient.get(`/problem/problemById/${problemId}`);
        const data = extractProblem(response.data);
        setProblem(data);

        // Safe startCode lookup
        const startEntry = data.startCode?.find(sc => sc.language === langMap[selectedLanguage]);
        setCode(startEntry?.initialCode || '// Start coding here...');
      } catch (error) {
        console.error('Error fetching problem:', error);
        setPageError('Failed to load problem. Please try again.');
      } finally {
        setPageLoading(false);
      }
    };

    fetchProblem();
  }, [problemId]);

  // Update code when language changes
  useEffect(() => {
    if (problem) {
      const startEntry = problem.startCode?.find(sc => sc.language === langMap[selectedLanguage]);
      setCode(startEntry?.initialCode || '// No starter code available for this language');
    }
  }, [selectedLanguage, problem]);

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);
  };

  const handleRun = async () => {
    setLoading(true);
    setRunResult(null);

    try {
      const response = await axiosClient.post(`/submission/run/${problemId}`, {
        code,
        language: selectedLanguage
      });
      setRunResult(response.data);
      setActiveRightTab('testcase');
    } catch (error) {
      console.error('Error running code:', error);
      setRunResult({
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Something went wrong'
      });
      setActiveRightTab('testcase');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    setLoading(true);
    setSubmitResult(null);

    try {
      const response = await axiosClient.post(`/submission/submit/${problemId}`, {
        code,
        language: selectedLanguage
      });
      setSubmitResult(response.data);
      setActiveRightTab('result');
    } catch (error) {
      console.error('Error submitting code:', error);
      setSubmitResult({
        accepted: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Submission failed'
      });
      setActiveRightTab('result');
    } finally {
      setLoading(false);
    }
  };

  const getLanguageForMonaco = (lang) => {
    switch (lang) {
      case 'javascript': return 'javascript';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      default: return 'javascript';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-50 text-emerald-600';
      case 'medium': return 'bg-amber-50 text-amber-600';
      case 'hard': return 'bg-red-50 text-red-600';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading problem...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">{pageError}</p>
          <NavLink to="/" className="btn-professional">Go Back</NavLink>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <NavLink to={problem?.subject ? `/subject/${problem.subject}` : '/'} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all">
            <ArrowLeft className="w-4 h-4" />
          </NavLink>
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Code className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900">{problem?.title}</span>
          {problem?.difficulty && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getDifficultyColor(problem.difficulty)}`}>
              {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/2 flex flex-col border-r border-slate-200">
          {/* Left Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-2">
            {['description', 'editorial', 'solutions', 'submissions', 'chatAI'].map(tab => (
              <button
                key={tab}
                className={`px-4 py-3 text-xs font-medium transition-all relative ${activeLeftTab === tab
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
                onClick={() => setActiveLeftTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('AI', ' AI')}
                {activeLeftTab === tab && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Left Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {problem && (
              <>
                {activeLeftTab === 'description' && (
                  <div className="animate-fade-in">
                    <div className="flex items-center gap-3 mb-6">
                      <h1 className="text-xl font-bold text-slate-900">{problem.title}</h1>
                      {problem.tags && (
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium">{problem.tags}</span>
                      )}
                    </div>

                    <div className="prose prose-slate prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {problem.description}
                      </div>
                    </div>

                    <div className="mt-8">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4">Examples</h3>
                      <div className="space-y-4">
                        {problem.visibleTestCases?.map((example, index) => (
                          <div key={index} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                            <h4 className="text-xs font-semibold text-slate-500 mb-3">Example {index + 1}</h4>
                            <div className="space-y-2 text-sm font-mono">
                              <div className="text-slate-700"><span className="text-slate-400">Input: </span>{example.input}</div>
                              <div className="text-slate-700"><span className="text-slate-400">Output: </span>{example.output}</div>
                              <div className="text-slate-600 text-xs font-sans mt-2">{example.explanation}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeLeftTab === 'editorial' && (
                  <div className="animate-fade-in">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Editorial</h2>
                    <Editorial secureUrl={problem.secureUrl} thumbnailUrl={problem.thumbnailUrl} duration={problem.duration} />
                  </div>
                )}

                {activeLeftTab === 'solutions' && (
                  <div className="animate-fade-in">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Reference Solutions</h2>
                    <div className="space-y-4">
                      {problem.referenceSolution?.map((solution, index) => (
                        <div key={index} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-700">{solution?.language}</h3>
                          </div>
                          <pre className="p-4 bg-slate-900 text-slate-100 text-sm overflow-x-auto">
                            <code>{solution?.completeCode}</code>
                          </pre>
                        </div>
                      )) || <p className="text-slate-400">Solutions will be available after solving.</p>}
                    </div>
                  </div>
                )}

                {activeLeftTab === 'submissions' && (
                  <div className="animate-fade-in">
                    <SubmissionHistory problemId={problemId} />
                  </div>
                )}

                {activeLeftTab === 'chatAI' && (
                  <div className="animate-fade-in">
                    <ChatAi problem={problem} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-1/2 flex flex-col">
          {/* Right Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-2">
            {['code', 'testcase', 'result'].map(tab => (
              <button
                key={tab}
                className={`px-4 py-3 text-xs font-medium transition-all relative ${activeRightTab === tab
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
                onClick={() => setActiveRightTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeRightTab === tab && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Right Content */}
          <div className="flex-1 flex flex-col">
            {activeRightTab === 'code' && (
              <div className="flex-1 flex flex-col">
                {/* Language Selector */}
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200 bg-white">
                  <div className="flex gap-1.5">
                    {['javascript', 'java', 'cpp'].map((lang) => (
                      <button
                        key={lang}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${selectedLanguage === lang
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        onClick={() => handleLanguageChange(lang)}
                      >
                        {lang === 'cpp' ? 'C++' : lang === 'javascript' ? 'JavaScript' : 'Java'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language={getLanguageForMonaco(selectedLanguage)}
                    value={code}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      insertSpaces: true,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      glyphMargin: false,
                      folding: true,
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'line',
                      padding: { top: 12 },
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="px-4 py-3 border-t border-slate-200 flex justify-between bg-white">
                  <button
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
                    onClick={() => setActiveRightTab('testcase')}
                  >
                    Console
                  </button>
                  <div className="flex gap-2">
                    <button
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleRun}
                      disabled={loading}
                    >
                      <Play className="w-3.5 h-3.5" /> Run
                    </button>
                    <button
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleSubmitCode}
                      disabled={loading}
                    >
                      <Send className="w-3.5 h-3.5" /> Submit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeRightTab === 'testcase' && (
              <div className="flex-1 p-4 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Test Results</h3>
                {runResult ? (
                  <div className={`p-4 rounded-xl border ${runResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {runResult.success ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <h4 className="font-semibold text-emerald-700">All test cases passed!</h4>
                        </div>
                        <p className="text-xs text-emerald-600">Runtime: {runResult.runtime} sec • Memory: {runResult.memory} KB</p>
                        <div className="mt-3 space-y-2">
                          {runResult.testCases?.map((tc, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-emerald-100 text-xs font-mono">
                              <div><span className="text-slate-400">Input:</span> {tc.stdin}</div>
                              <div><span className="text-slate-400">Expected:</span> {tc.expected_output}</div>
                              <div><span className="text-slate-400">Output:</span> {tc.stdout}</div>
                              <div className="text-emerald-600 mt-1">✓ Passed</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <XCircle className="w-5 h-5 text-red-600" />
                          <h4 className="font-semibold text-red-700">Some tests failed</h4>
                        </div>
                        <div className="mt-3 space-y-2">
                          {runResult.testCases?.map((tc, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-red-100 text-xs font-mono">
                              <div><span className="text-slate-400">Input:</span> {tc.stdin}</div>
                              <div><span className="text-slate-400">Expected:</span> {tc.expected_output}</div>
                              <div><span className="text-slate-400">Output:</span> {tc.stdout}</div>
                              <div className={tc.status_id == 3 ? 'text-emerald-600 mt-1' : 'text-red-600 mt-1'}>
                                {tc.status_id == 3 ? '✓ Passed' : '✗ Failed'}
                              </div>
                            </div>
                          ))}
                        </div>
                        {runResult.error && (
                          <p className="mt-3 text-xs text-red-600">{runResult.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Click "Run" to test your code with the example test cases.</p>
                )}
              </div>
            )}

            {activeRightTab === 'result' && (
              <div className="flex-1 p-4 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Submission Result</h3>
                {submitResult ? (
                  <div className={`p-6 rounded-xl border ${submitResult.accepted ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {submitResult.accepted ? (
                      <div className="text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <h4 className="text-lg font-bold text-emerald-700 mb-4">Accepted! 🎉</h4>
                        <div className="space-y-2 text-sm text-emerald-600">
                          <p>Test Cases: {submitResult.passedTestCases}/{submitResult.totalTestCases}</p>
                          <p>Runtime: {submitResult.runtime} sec</p>
                          <p>Memory: {submitResult.memory} KB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <h4 className="text-lg font-bold text-red-700 mb-4">Not Accepted</h4>
                        <div className="space-y-2 text-sm text-red-600">
                          <p>Test Cases Passed: {submitResult.passedTestCases}/{submitResult.totalTestCases}</p>
                          {submitResult.errorMessage || submitResult.error ? (
                            <p>{submitResult.errorMessage || submitResult.error}</p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Click "Submit" to submit your solution for evaluation.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemPage;
