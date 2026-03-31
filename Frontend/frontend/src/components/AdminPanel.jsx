import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axiosClient from '../utils/axiosClient';
import { useNavigate, NavLink } from 'react-router';
import { ArrowLeft, Code, Plus, Trash2, Send } from 'lucide-react';

const problemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  subject: z.enum(['DSA', 'DAA', 'OOPs', 'CProgramming']),
  tags: z.enum(['array', 'LinkedList', 'Graph', 'DP', 'Stack', 'Queue', 'Tree', 'Sorting', 'Searching', 'Greedy', 'Backtracking', 'Recursion', 'String', 'Math', 'BitManipulation', 'Classes', 'Inheritance', 'Polymorphism', 'Encapsulation', 'Abstraction', 'Pointers', 'Structures', 'FileHandling', 'Functions', 'Loops', 'DivideAndConquer', 'DynamicProgramming', 'BranchAndBound', 'NetworkFlow']),
  visibleTestCases: z.array(
    z.object({
      input: z.string().min(1, 'Input is required'),
      output: z.string().min(1, 'Output is required'),
      explanation: z.string().min(1, 'Explanation is required')
    })
  ).min(1, 'At least one visible test case required'),
  hiddenTestCases: z.array(
    z.object({
      input: z.string().min(1, 'Input is required'),
      output: z.string().min(1, 'Output is required')
    })
  ).min(1, 'At least one hidden test case required'),
  startCode: z.array(
    z.object({
      language: z.enum(['C++', 'Java', 'JavaScript']),
      initialCode: z.string().min(1, 'Initial code is required')
    })
  ).length(3, 'All three languages required'),
  referenceSolution: z.array(
    z.object({
      language: z.enum(['C++', 'Java', 'JavaScript']),
      completeCode: z.string().min(1, 'Complete code is required')
    })
  ).length(3, 'All three languages required')
});

function AdminPanel() {
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(problemSchema),
    defaultValues: {
      startCode: [
        { language: 'C++', initialCode: '' },
        { language: 'Java', initialCode: '' },
        { language: 'JavaScript', initialCode: '' }
      ],
      referenceSolution: [
        { language: 'C++', completeCode: '' },
        { language: 'Java', completeCode: '' },
        { language: 'JavaScript', completeCode: '' }
      ]
    }
  });

  const {
    fields: visibleFields,
    append: appendVisible,
    remove: removeVisible
  } = useFieldArray({ control, name: 'visibleTestCases' });

  const {
    fields: hiddenFields,
    append: appendHidden,
    remove: removeHidden
  } = useFieldArray({ control, name: 'hiddenTestCases' });

  const onSubmit = async (data) => {
    try {
      await axiosClient.post('/problem/create', data);
      alert('Problem created successfully!');
      navigate('/admin');
    } catch (error) {
      alert(`Error: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <NavLink to="/admin" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </NavLink>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900">Create Problem</span>
            <p className="text-xs text-slate-400">Add a new coding challenge</p>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="card-professional p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                <input {...register('title')} className={`w-full px-4 py-3 rounded-xl border ${errors.title ? 'border-red-300' : 'border-slate-200'} bg-slate-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`} placeholder="Problem title" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea {...register('description')} rows={6} className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-300' : 'border-slate-200'} bg-slate-50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`} placeholder="Problem description..." />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Difficulty</label>
                  <select {...register('difficulty')} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                  <select {...register('subject')} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="DSA">DSA</option>
                    <option value="DAA">DAA</option>
                    <option value="OOPs">OOPs</option>
                    <option value="CProgramming">C Programming</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tag</label>
                  <select {...register('tags')} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="array">Array</option>
                    <option value="LinkedList">Linked List</option>
                    <option value="Graph">Graph</option>
                    <option value="DP">DP</option>
                    <option value="Stack">Stack</option>
                    <option value="Queue">Queue</option>
                    <option value="Tree">Tree</option>
                    <option value="Sorting">Sorting</option>
                    <option value="Searching">Searching</option>
                    <option value="Greedy">Greedy</option>
                    <option value="Recursion">Recursion</option>
                    <option value="String">String</option>
                    <option value="Classes">Classes</option>
                    <option value="Inheritance">Inheritance</option>
                    <option value="Polymorphism">Polymorphism</option>
                    <option value="Pointers">Pointers</option>
                    <option value="Structures">Structures</option>
                    <option value="Functions">Functions</option>
                    <option value="Loops">Loops</option>
                    <option value="DivideAndConquer">Divide & Conquer</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Test Cases */}
          <div className="card-professional p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-900">Visible Test Cases</h2>
              <button type="button" onClick={() => appendVisible({ input: '', output: '', explanation: '' })} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="space-y-4">
              {visibleFields.map((field, index) => (
                <div key={field.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Test Case {index + 1}</span>
                    <button type="button" onClick={() => removeVisible(index)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input {...register(`visibleTestCases.${index}.input`)} placeholder="Input" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                  <input {...register(`visibleTestCases.${index}.output`)} placeholder="Output" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                  <textarea {...register(`visibleTestCases.${index}.explanation`)} placeholder="Explanation" rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              ))}
            </div>
          </div>

          <div className="card-professional p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-900">Hidden Test Cases</h2>
              <button type="button" onClick={() => appendHidden({ input: '', output: '' })} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="space-y-4">
              {hiddenFields.map((field, index) => (
                <div key={field.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Hidden Case {index + 1}</span>
                    <button type="button" onClick={() => removeHidden(index)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input {...register(`hiddenTestCases.${index}.input`)} placeholder="Input" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                  <input {...register(`hiddenTestCases.${index}.output`)} placeholder="Output" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Code Templates */}
          <div className="card-professional p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Code Templates</h2>
            <div className="space-y-6">
              {[0, 1, 2].map((index) => (
                <div key={index}>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    {index === 0 ? 'C++' : index === 1 ? 'Java' : 'JavaScript'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Starter Code</label>
                      <textarea {...register(`startCode.${index}.initialCode`)} rows={5} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Reference Solution</label>
                      <textarea {...register(`referenceSolution.${index}.completeCode`)} rows={5} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full btn-professional flex items-center justify-center gap-2 py-4">
            <Send className="w-4 h-4" /> Create Problem
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminPanel;