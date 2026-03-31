import { Plus, Trash2, Video, ClipboardList, ArrowLeft, Code } from 'lucide-react';
import { NavLink } from 'react-router';

function Admin() {
  const adminOptions = [
    {
      id: 'create',
      title: 'Create Problem',
      description: 'Add a new coding problem to the platform',
      icon: Plus,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      route: '/admin/create'
    },
    {
      id: 'delete',
      title: 'Delete Problem',
      description: 'Remove problems from the platform',
      icon: Trash2,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      route: '/admin/delete'
    },
    {
      id: 'video',
      title: 'Manage Videos',
      description: 'Upload and manage editorial videos',
      icon: Video,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      route: '/admin/video'
    },
    {
      id: 'assignment',
      title: 'Create Assignment',
      description: 'Create and manage assignments for students',
      icon: ClipboardList,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      route: '/admin/assignment'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-50 navbar-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <NavLink to="/" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </NavLink>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900">Admin Panel</span>
            <p className="text-xs text-slate-400">Manage your platform</p>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
          <p className="text-slate-500">Manage coding problems and course content</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {adminOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <NavLink
                key={option.id}
                to={option.route}
                className={`group card-professional p-8 animate-fade-in-up stagger-${index+1}`}
              >
                <div className={`w-14 h-14 rounded-2xl ${option.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${option.iconColor}`} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">{option.title}</h2>
                <p className="text-sm text-slate-500">{option.description}</p>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Admin;