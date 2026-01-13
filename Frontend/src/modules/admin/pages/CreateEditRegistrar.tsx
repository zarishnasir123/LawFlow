import React from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, UserPlus, Mail, Shield, CheckCircle } from 'lucide-react';

// Reusable UI Components (Aap inhein alag file se bhi import kar sakti hain)
const FormField = ({ label, error, children }: any) => (
  <div className="space-y-1.5 w-full">
    <label className="text-sm font-semibold text-gray-700 ml-1">{label}</label>
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

interface CreateEditRegistrarProps {
  navigate: (page: string, data?: any) => void;
  registrar?: any;
}

export const CreateEditRegistrar: React.FC<CreateEditRegistrarProps> = ({ navigate, registrar }) => {
  const isEdit = !!registrar;

  // React Hook Form initialization
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: registrar?.name || '',
      email: registrar?.email || '',
      phone: registrar?.phone || '',
      cnic: registrar?.cnic || '',
      role: registrar?.role || 'Registrar',
      permissions: registrar?.permissions || [],A
      password: '',
      confirmPassword: ''
    }
  });

  const availablePermissions = [
    { id: 'view_cases', label: 'View Cases' },
    { id: 'process_cases', label: 'Process Cases' },
    { id: 'generate_reports', label: 'Generate Reports' },
    { id: 'manage_documents', label: 'Manage Documents' },
    { id: 'schedule_hearings', label: 'Schedule Hearings' },
  ];

  const onSubmit = (data: any) => {
    console.log("Form Submitted:", data);
    alert(isEdit ? "Registrar Updated!" : "Registrar Created! Credentials sent via Gmail.");
    navigate('manage-registrars');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Header */}
      <header className="bg-[#01411C] text-white py-6 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('manage-registrars')}
              className="p-2 hover:bg-white/10 rounded-full transition-all border border-white/20"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold">{isEdit ? 'Edit Registrar Profile' : 'Register New Staff'}</h1>
              <p className="text-xs text-green-200">LawFlow Administrative Services</p>
            </div>
          </div>
          <Shield className="opacity-20" size={32} />
        </div>
      </header>

      <main className="container mx-auto px-6 mt-8 max-w-4xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Section 1: Personal Info */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <div className="p-2 bg-green-50 rounded-lg">
                <UserPlus className="text-[#01411C]" size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Account Details</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FormField label="Full Name *" error={errors.name?.message}>
                <input {...register('name', { required: 'Name is required' })} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none transition-all" 
                  placeholder="e.g. Muhammad Asif" />
              </FormField>

              <FormField label="Email Address (Gmail) *" error={errors.email?.message}>
                <input {...register('email', { required: 'Gmail is required', pattern: /^\S+@\S+$/i })} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none" 
                  placeholder="asif@gmail.com" />
              </FormField>

              <FormField label="Phone Number *" error={errors.phone?.message}>
                <input {...register('phone', { required: 'Phone is required' })} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none" 
                  placeholder="03xx-xxxxxxx" />
              </FormField>

              <FormField label="CNIC Number *" error={errors.cnic?.message}>
                <input {...register('cnic', { required: 'CNIC is required' })} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none" 
                  placeholder="xxxxx-xxxxxxx-x" />
              </FormField>

              <FormField label="Official Designation">
                <select {...register('role')} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-green-100 outline-none">
                  <option value="Registrar">Registrar</option>
                  <option value="Senior Registrar">Senior Registrar</option>
                  <option value="Assistant Registrar">Assistant Registrar</option>
                </select>
              </FormField>
            </div>

            {/* Password Fields - Only for NEW registration */}
            {!isEdit && (
              <div className="grid md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-dashed">
                <FormField label="Password *" error={errors.password?.message}>
                  <input type="password" {...register('password', { required: 'Password required', minLength: 6 })} 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" />
                </FormField>
                <FormField label="Confirm Password *" error={errors.confirmPassword?.message}>
                  <input type="password" {...register('confirmPassword', { 
                    validate: (val) => val === watch('password') || "Passwords don't match"
                  })} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" />
                </FormField>
              </div>
            )}
          </section>

          {/* Section 2: Permissions */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
             <h2 className="text-lg font-bold text-gray-800 mb-4">Access Permissions</h2>
             <div className="grid sm:grid-cols-2 gap-3">
               {availablePermissions.map((perm) => (
                 <label key={perm.id} className="flex items-center p-3 rounded-xl border border-gray-100 hover:bg-green-50/50 cursor-pointer transition-colors group">
                   <input type="checkbox" value={perm.label} {...register('permissions')} 
                    className="w-5 h-5 rounded border-gray-300 text-[#01411C] focus:ring-[#01411C]" />
                   <span className="ml-3 text-sm font-medium text-gray-600 group-hover:text-gray-900">{perm.label}</span>
                 </label>
               ))}
             </div>
          </section>

          {/* Notification Alert */}
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
             <Mail className="text-blue-600 mt-1" size={20} />
             <p className="text-sm text-blue-800 leading-relaxed">
               <strong>Gmail Notification:</strong> System will automatically send encrypted login credentials and 
               access guidelines to the provided email address upon {isEdit ? 'update' : 'creation'}.
             </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
             <button type="button" onClick={() => navigate('manage-registrars')}
               className="flex-1 py-3.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-100 transition-all">
               Discard
             </button>
             <button type="submit"
               className="flex-[2] py-3.5 rounded-xl bg-[#01411C] text-white font-bold hover:bg-[#024a23] shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2">
               {isEdit ? <Save size={20} /> : <CheckCircle size={20} />}
               {isEdit ? 'Update Registrar Profile' : 'Confirm & Create Account'}
             </button>
          </div>
        </form>
      </main>
    </div>
  );
};