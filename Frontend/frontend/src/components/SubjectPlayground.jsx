import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import axiosClient from '../utils/axiosClient';
import { Play, RotateCcw, TerminalSquare } from 'lucide-react';

const starterTemplates = {
  javascript: `function solve(input) {
  const text = input.trim();
  return text ? text : "Hello from JavaScript";
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const output = solve(input);
if (output !== undefined) {
  process.stdout.write(String(output));
}
`,
  java: `import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String input = br.readLine();
        if (input == null || input.isBlank()) {
            System.out.println("Hello from Java");
        } else {
            System.out.println(input.trim());
        }
    }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string input;
    getline(cin, input);

    if (input.empty()) {
        cout << "Hello from C++";
    } else {
        cout << input;
    }

    return 0;
}
`
};

const languageLabels = {
  javascript: 'JavaScript',
  java: 'Java',
  cpp: 'C++'
};

const monacoLanguages = {
  javascript: 'javascript',
  java: 'java',
  cpp: 'cpp'
};

function SubjectPlayground() {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [codeByLanguage, setCodeByLanguage] = useState(starterTemplates);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const activeCode = codeByLanguage[selectedLanguage];

  const consoleOutput = useMemo(() => {
    if (!result) {
      return 'Run your code to see stdout, stderr, and compile feedback here.';
    }

    return result.console || 'Program finished with no output.';
  }, [result]);

  const handleCodeChange = (value) => {
    setCodeByLanguage((current) => ({
      ...current,
      [selectedLanguage]: value || ''
    }));
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);
    setResult(null);
  };

  const handleReset = () => {
    setCodeByLanguage((current) => ({
      ...current,
      [selectedLanguage]: starterTemplates[selectedLanguage]
    }));
    setResult(null);
  };

  const handleRun = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data } = await axiosClient.post('/submission/playground', {
        code: activeCode,
        language: selectedLanguage,
        stdin
      });

      setResult(data);
    } catch (error) {
      console.error('Error running playground code:', error);
      setResult({
        success: false,
        status: 'Execution failed',
        console: error.response?.data?.message || error.response?.data?.error || 'Something went wrong while running the code.',
        time: null,
        memory: null
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-14 animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="eyebrow-pill mb-4">Instant practice lab</div>
        <h2 className="page-title text-3xl md:text-4xl font-bold mb-3">Try Code Right Here</h2>
        <p className="page-subtitle text-base max-w-2xl mx-auto">
          Switch between Java, C++, and JavaScript, type code, give input, and see real Judge0 output in a live console.
        </p>
      </div>

      <div className="surface-panel p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
          <div className="flex flex-wrap gap-2">
            {Object.keys(languageLabels).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => handleLanguageChange(language)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  selectedLanguage === language
                    ? 'bg-[#2147ba] text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {languageLabels[language]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="ghost-button px-4 py-2 text-sm font-bold text-stone-700"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              className={`btn-professional px-5 py-2.5 text-sm ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Code
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.9fr] gap-5">
          <div className="overflow-hidden rounded-3xl border border-stone-200/80 bg-[#0b1020] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f172a]">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2">{languageLabels[selectedLanguage]} Playground</span>
              </div>
              <span className="text-[11px] text-slate-400">Ctrl/Cmd style practice feel</span>
            </div>
            <Editor
              height="460px"
              language={monacoLanguages[selectedLanguage]}
              value={activeCode}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                wordWrap: 'on',
                padding: { top: 14, bottom: 14 }
              }}
            />
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-stone-200/80 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <TerminalSquare className="w-4 h-4 text-[#2147ba]" />
                <h3 className="text-sm font-bold text-stone-900">Program Input</h3>
              </div>
              <textarea
                value={stdin}
                onChange={(event) => setStdin(event.target.value)}
                placeholder={'Type stdin here...\nExample:\n5\n1 2 3 4 5'}
                className="input-luxe min-h-[140px] w-full px-4 py-3 text-sm resize-none"
              />
              <p className="text-xs text-stone-500 mt-2">This input is sent directly to Judge0 as standard input.</p>
            </div>

            <div className="rounded-3xl border border-stone-200/80 bg-[#0b1020] text-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold">Console</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {result ? `${result.status}${result.time ? ` | ${result.time}s` : ''}${result.memory ? ` | ${result.memory} KB` : ''}` : 'Waiting for execution'}
                  </p>
                </div>
                {result ? (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${result.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {result.success ? 'Success' : 'Error'}
                  </span>
                ) : null}
              </div>
              <pre className="min-h-[258px] p-4 text-sm leading-6 whitespace-pre-wrap overflow-auto font-mono">
                {consoleOutput}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SubjectPlayground;
