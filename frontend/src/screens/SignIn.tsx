import { ButtonLink } from '../components/Button';
import { authStyles } from './AuthForm';
import SignInForm from './SignInForm';

export default function SignIn() {
  return (
    <SignInForm
      title="Welcome back"
      subtitle="Sign in to see who's resting."
      footer={
        <div className={authStyles.switch}>
          <span>New here?</span>
          <ButtonLink to="/signup" variant="ghost" small>
            Sign up
          </ButtonLink>
        </div>
      }
    />
  );
}
