import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, GraduationCap, Eye, EyeOff, BookOpen } from 'lucide-react';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { db } from '@/lib/db';
import { useStore } from '@/store/useStore';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    academicLevel: 'JAMB' as 'JSS' | 'SSS' | 'JAMB' | 'University'
  });

  const setCurrentUser = useStore(state => state.setCurrentUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const user = await db.users.where('email').equals(formData.email.toLowerCase()).first();
        
        if (!user || user.password !== formData.password) {
          setError('Invalid email or password');
          setLoading(false);
          return;
        }

        setCurrentUser({
          id: String(user.id!),
          email: user.email,
          fullName: user.fullName,
          academicLevel: user.academicLevel,
          streak: user.streak,
          questionsAnswered: user.totalQuestionsAnswered,
          correctAnswers: user.totalCorrect
        });
      } else {
        // Signup
        const existingUser = await db.users.where('email').equals(formData.email.toLowerCase()).first();
        
        if (existingUser) {
          setError('Email already registered');
          setLoading(false);
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        
        const id = await db.users.add({
          email: formData.email.toLowerCase(),
          password: formData.password,
          fullName: formData.fullName,
          academicLevel: formData.academicLevel,
          createdAt: new Date(),
          streak: 1,
          lastActiveDate: today,
          totalQuestionsAnswered: 0,
          totalCorrect: 0
        });

        setCurrentUser({
          id: String(id),
          email: formData.email.toLowerCase(),
          fullName: formData.fullName,
          academicLevel: formData.academicLevel,
          streak: 1,
          questionsAnswered: 0,
          correctAnswers: 0
        });
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-8 ambient-bg">
      {/* Logo & Branding */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-[0_0_40px_rgba(0,122,255,0.4)]">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
        <h1 
          className="text-3xl font-black text-white mb-1"
          style={{ fontFamily: 'Clash Display, sans-serif' }}
        >
          STUDENTHUB NG
        </h1>
        <p className="text-white/60 text-sm">The best free study platform in Nigeria</p>
      </motion.div>

      {/* Auth Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="max-w-md mx-auto w-full" hover={false}>
          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isLogin ? 'bg-primary text-white shadow-lg' : 'text-white/60'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !isLogin ? 'bg-primary text-white shadow-lg' : 'text-white/60'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Input
                    label="Full Name"
                    placeholder="Enter your full name"
                    icon={<User size={18} />}
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    required={!isLogin}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              icon={<Mail size={18} />}
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={<Lock size={18} />}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-white/40 hover:text-white/60"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Select
                    label="Academic Level"
                    value={formData.academicLevel}
                    onChange={e => setFormData({ ...formData, academicLevel: e.target.value as 'JSS' | 'SSS' | 'JAMB' | 'University' })}
                    options={[
                      { value: 'JSS', label: 'Junior Secondary School (JSS)' },
                      { value: 'SSS', label: 'Senior Secondary School (SSS)' },
                      { value: 'JAMB', label: 'JAMB Candidate' },
                      { value: 'University', label: 'University Student' }
                    ]}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-error text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              icon={<GraduationCap size={20} />}
            >
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
            </Button>
          </form>
        </GlassCard>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-white/30 text-xs mt-8"
      >
        Built by EMEMZYVISUALS
      </motion.p>
    </div>
  );
}
