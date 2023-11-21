import { Button, Image, Input, Spinner } from '@fluentui/react-components';
import React, { useState } from 'react';
import './style.css';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { VerticalSpace1, VerticalSpace2 } from '../common/verticalSpace';
import Logo from '../assets/images/logo.png';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logginIn, setLogginIn] = useState(false);

  const onLogin = async () => {
    if (logginIn) return;
    try {
      setLogginIn(true);
      try {
        const auth = getAuth();
        await signInWithEmailAndPassword(
          auth,
          `${username}@gmail.com`,
          password,
        );
      } catch (e) {
        console.log(e);
      }

      setLogginIn(false);
    } catch (e) {
      console.log(e);
      setLogginIn(false);
    }
  };

  return (
    <div className="login-screen-container">
      <Image width={200} src={Logo} />
      <VerticalSpace2 />
      <VerticalSpace2 />
      <Input
        onChange={(e) => setUsername(e.target.value)}
        value={username}
        className="input"
        placeholder="Username"
        size="large"
        onKeyDown={(e) => handleKeyUp(e)}
      />
      <VerticalSpace1 />
      <Input
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        value={password}
        className="input"
        placeholder="Password"
        size="large"
      />
      <VerticalSpace1 />
      <Button onClick={() => onLogin()} size="large" appearance="primary">
        {logginIn ? <Spinner size="tiny" /> : 'Login'}
      </Button>
    </div>
  );
}
