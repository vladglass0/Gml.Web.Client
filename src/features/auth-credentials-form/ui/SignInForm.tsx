'use client';

import { type HTMLAttributes, useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { SignInFormSchemaType, signInSchema } from '@/features/auth-credentials-form/lib/static';
import { useLogin } from '@/shared/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Icons } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/input';

interface SignInFormProps extends HTMLAttributes<HTMLDivElement> {}

declare const process: {
  env: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  };
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: string;
          size?: string;
        },
      ) => number;
      reset: (widgetId: number) => void;
    };
  }
}

export function SignInForm({ className, ...props }: SignInFormProps) {
  const { mutateAsync, isPending } = useLogin();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<SignInFormSchemaType>({
    resolver: zodResolver(signInSchema),
  });

  const renderTurnstile = useCallback(() => {
    if (!siteKey) {
      setTurnstileError(
        'Turnstile не настроен. Укажите NEXT_PUBLIC_TURNSTILE_SITE_KEY в .env',
      );
      return;
    }

    if (!window.turnstile || widgetId !== null || !widgetRef.current) {
      return;
    }

    const id = window.turnstile.render(widgetRef.current, {
      sitekey: siteKey,
      callback: (token) => {
        form.setValue('turnstileToken', token, { shouldValidate: true });
        form.clearErrors('turnstileToken');
        setTurnstileError(null);
      },
      'error-callback': () => {
        form.setValue('turnstileToken', '');
        setTurnstileError('Turnstile завершился с ошибкой, попробуйте снова.');
      },
      'expired-callback': () => {
        form.setValue('turnstileToken', '');
        setTurnstileError('Сессия Turnstile истекла. Пройдите проверку снова.');
      },
    });

    setWidgetId(id);
  }, [form, siteKey, widgetId]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    if (window.turnstile) {
      renderTurnstile();
    }
  }, [renderTurnstile, siteKey]);

  const onSubmit: SubmitHandler<SignInFormSchemaType> = async (data) => {
    if (siteKey && !data.turnstileToken) {
      form.setError('turnstileToken', {
        type: 'manual',
        message: 'Пожалуйста, подтвердите, что вы не робот.',
      });
      return;
    }

    await mutateAsync(data);
  };

  return (
    <div className={cn('grid gap-4', className)} {...props}>
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register('turnstileToken')} />

          <FormItem>
            <FormLabel>Введите логин</FormLabel>
            <FormControl>
              <Input placeholder="Введите логин" {...form.register('login')} />
            </FormControl>
            {form.formState.errors.login && (
              <FormMessage>{form.formState.errors.login.message}</FormMessage>
            )}
          </FormItem>

          <FormItem>
            <FormLabel>Введите пароль</FormLabel>
            <FormControl>
              <Input type="password" placeholder="Введите пароль" {...form.register('password')} />
            </FormControl>
            {form.formState.errors.password && (
              <FormMessage>{form.formState.errors.password.message}</FormMessage>
            )}
          </FormItem>

          <FormItem>
            <FormLabel>Проверка безопасности</FormLabel>
            <FormControl>
              <div ref={widgetRef} />
            </FormControl>
            {turnstileError && <FormMessage>{turnstileError}</FormMessage>}
            {form.formState.errors.turnstileToken && (
              <FormMessage>{form.formState.errors.turnstileToken.message}</FormMessage>
            )}
          </FormItem>

          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={renderTurnstile}
          />

          <Button className="w-full" disabled={isPending || !siteKey}>
            {isPending && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Войти
          </Button>
        </form>
      </Form>
    </div>
  );
}
