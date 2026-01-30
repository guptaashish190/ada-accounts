import {
  Button,
  Image,
  Input,
  Spinner,
  Text,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import React, { useState } from 'react';
import './style.css';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { VerticalSpace1, VerticalSpace2 } from '../common/verticalSpace';
import Logo from '../assets/images/logo.png';
import { firebaseAuth } from '../firebaseInit';
import { showToast } from '../common/toaster';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logginIn, setLogginIn] = useState(false);
  const [error, setError] = useState('');

  const toasterId = useId('login-toaster');
  const { dispatchToast } = useToastController(toasterId);

  /**
   * Get user-friendly error message from Firebase auth error
   */
  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect password. Please try again.';
      case 'auth/user-not-found':
        return 'User not found. Please check your username.';
      case 'auth/invalid-email':
        return 'Invalid email format.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return 'Login failed. Please try again.';
    }
  };

  const onLogin = async () => {
    if (logginIn) return;

    // Clear previous errors
    setError('');

    // Validate inputs
    if (!username.trim()) {
      setError('Please enter your username');
      showToast(dispatchToast, 'Please enter your username', 'error');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      showToast(dispatchToast, 'Please enter your password', 'error');
      return;
    }

    try {
      setLogginIn(true);
      await signInWithEmailAndPassword(
        firebaseAuth,
        `${username}@gmail.com`,
        password,
      );
      // Success - LoginWrapper will handle the redirect
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = getErrorMessage(error.code);
      setError(errorMessage);
      showToast(dispatchToast, errorMessage, 'error');
    } finally {
      setLogginIn(false);
    }
  };

  // Clear error when user starts typing
  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !logginIn) {
      onLogin();
    }
  };

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className="login-screen-container">
        <Image width={200} src={Logo} />
        <VerticalSpace2 />
        <VerticalSpace2 />
        <Input
          onChange={handleUsernameChange}
          onKeyPress={handleKeyPress}
          value={username}
          className="input"
          placeholder="Username"
          size="large"
          disabled={logginIn}
        />
        <VerticalSpace1 />
        <Input
          onChange={handlePasswordChange}
          onKeyPress={handleKeyPress}
          type="password"
          value={password}
          className="input"
          placeholder="Password"
          size="large"
          disabled={logginIn}
        />
        {error && (
          <>
            <VerticalSpace1 />
            <Text
              style={{
                color: 'var(--colorPaletteRedForeground1)',
                fontSize: 'var(--fontSizeBase200)',
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
          </>
        )}
        <VerticalSpace1 />
        <Button
          onClick={onLogin}
          size="large"
          appearance="primary"
          disabled={logginIn}
        >
          {logginIn ? <Spinner size="tiny" /> : 'Login'}
        </Button>
      </div>
    </>
  );
}
