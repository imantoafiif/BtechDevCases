import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormValues, type RegisterInput } from '@btech/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import * as authApi from '../api/auth.api';
import { applyApiError } from '../api/form-errors';
import { ApiError } from '../api/http';
import { FormField } from '../components/FormField';

export function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterInput) => {
    try {
      await authApi.register(values);
      navigate('/login?registered=1');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: error.message });
        return;
      }
      applyApiError(error, setError, ['email', 'password', 'confirmPassword']);
    }
  };

  return (
    <main className="card">
      <h1>Create an account</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
