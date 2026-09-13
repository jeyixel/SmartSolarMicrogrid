import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders smart solar microgrid title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Smart Solar Microgrid/i);
  expect(titleElement).toBeInTheDocument();
});
