/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import {
  Spinner,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import globalUtils from '../services/globalUtils';
import firebaseApp from '../firebaseInit';
import Loader from '../common/loader';
import { showToast } from '../common/toaster';
import Calculator from '../screens/calculator/calculator';

export default function CalculatorWrapper({ children }) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isComponentVisible, setIsComponentVisible] = useState(false);

  useEffect(() => {
    const handleMouseClick = (e) => {
      if (e.ctrlKey) {
        // Get mouse coordinates
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Set component position
        setPosition({ top: mouseY, left: mouseX });

        // Show the component
        setIsComponentVisible(true);

        console.log('With ctrl, do something...');
        return;
      }
      // Hide the component on mouse click
      setIsComponentVisible(false);
    };

    // Add event listeners
    window.addEventListener('click', handleMouseClick);

    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener('click', handleMouseClick);
    };
  }, []);
  return (
    <>
      {children}
      {/* Conditional rendering of the dynamic component */}
      {isComponentVisible && (
        <Calculator
          setIsComponentVisible={setIsComponentVisible}
          top={position.top}
          left={position.left}
        />
      )}
    </>
  );
}
