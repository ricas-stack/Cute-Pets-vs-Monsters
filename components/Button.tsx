import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export const Button: React.FC<ButtonProps> = ({ onClick, children, className = '', disabled = false, variant = 'primary' }) => {
  const baseStyles = "px-6 py-3 rounded-2xl font-bold shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  let variantStyles = "";
  switch(variant) {
    case 'primary':
      variantStyles = "bg-blue-500 hover:bg-blue-400 text-white border-b-4 border-blue-700";
      break;
    case 'secondary':
      variantStyles = "bg-white hover:bg-gray-50 text-gray-800 border-b-4 border-gray-300";
      break;
    case 'success':
      variantStyles = "bg-green-500 hover:bg-green-400 text-white border-b-4 border-green-700";
      break;
    case 'danger':
      variantStyles = "bg-red-500 hover:bg-red-400 text-white border-b-4 border-red-700";
      break;
  }

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
};