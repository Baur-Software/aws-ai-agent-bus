import { useNavigate } from '@solidjs/router';
import { onMount } from 'solid-js';

interface RedirectProps {
  to: string;
}

export default function Redirect(props: RedirectProps) {
  const navigate = useNavigate();

  onMount(() => {
    navigate(props.to, { replace: true });
  });

  return null;
}