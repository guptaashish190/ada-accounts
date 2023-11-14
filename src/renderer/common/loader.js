import { Spinner } from '@fluentui/react-components';

export default function Loader({ translucent }) {
  return (
    <center
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: translucent ? '#ffffff99' : 'white',
        zIndex: 12,
      }}
    >
      <Spinner />
    </center>
  );
}
