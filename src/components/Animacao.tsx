"use client";

import { useEffect, useRef } from "react";

type DadosLottie = { op: number; w: number; h: number } & Record<string, unknown>;

/**
 * Player Lottie leve (lottie-web "light": só SVG, sem eval — compatível com a CSP).
 * - Carrega o player sob demanda, fora do bundle inicial.
 * - Com "reduzir movimento" ativo, mostra direto o quadro final (ou o inicial, em loops).
 * - Pausa quando sai da tela.
 */
export function Animacao({
  dados,
  rotulo,
  loop = false,
  className,
}: {
  dados: DadosLottie;
  rotulo?: string;
  loop?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelado = false;
    let destruir: (() => void) | undefined;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelado) return;
      const anim = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: loop && !reduzir,
        autoplay: false,
        animationData: dados,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: false },
      });
      anim.addEventListener("DOMLoaded", () => {
        if (reduzir) anim.goToAndStop(loop ? 0 : dados.op - 1, true);
        else anim.play();
      });
      let obs: IntersectionObserver | undefined;
      if (loop && !reduzir) {
        obs = new IntersectionObserver(([e]) => (e?.isIntersecting ? anim.play() : anim.pause()));
        obs.observe(el);
      }
      destruir = () => {
        obs?.disconnect();
        anim.destroy();
      };
    });

    return () => {
      cancelado = true;
      destruir?.();
    };
  }, [dados, loop]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ aspectRatio: `${dados.w} / ${dados.h}` }}
      {...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true })}
    />
  );
}
