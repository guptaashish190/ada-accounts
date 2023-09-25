import {
  Toast,
  ToastFooter,
  ToastTitle,
  Link,
  ToastBody,
} from '@fluentui/react-components';

export const showToast = (dispatchToast, text, type) =>
  dispatchToast(
    <Toast>
      <ToastTitle>{text}</ToastTitle>
    </Toast>,
    { intent: type },
  );

export const temp = () => {};
