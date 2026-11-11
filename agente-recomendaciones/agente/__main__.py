import argparse
import json
import sys
from pathlib import Path
from .motor import analizar, EntradaInvalida
from .narrativa import redactar, construir_mensajes
from .informe import generar_html, generar_pdf

def leer(path): return json.loads(Path(path).read_text(encoding='utf-8'))
def guardar(path,data):
    p=Path(path); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    parser=argparse.ArgumentParser(prog='python -m agente'); subs=parser.add_subparsers(dest='comando',required=True)
    a=subs.add_parser('analizar'); a.add_argument('entrada'); a.add_argument('-o',required=True)
    m=subs.add_parser('mensajes'); m.add_argument('analisis'); m.add_argument('-o',required=True)
    i=subs.add_parser('informe'); i.add_argument('analisis'); i.add_argument('-n'); i.add_argument('-o',required=True); i.add_argument('--pdf'); i.add_argument('--navegador'); i.add_argument('--logo')
    t=subs.add_parser('todo'); t.add_argument('entrada'); t.add_argument('-d',required=True); t.add_argument('--pdf',action='store_true'); t.add_argument('--navegador')
    args=parser.parse_args()
    try:
        if args.comando=='analizar': guardar(args.o,analizar(leer(args.entrada)))
        elif args.comando=='mensajes': guardar(args.o,construir_mensajes(leer(args.analisis)))
        elif args.comando=='informe':
            analisis=leer(args.analisis); narrativa=leer(args.n) if args.n else redactar(analisis)[0]; generar_html(analisis,narrativa,args.o,args.logo)
            if args.pdf: generar_pdf(args.o,args.pdf,args.navegador)
        else:
            d=Path(args.d); d.mkdir(parents=True,exist_ok=True); analisis=analizar(leer(args.entrada)); narrativa,origen=redactar(analisis); guardar(d/'analisis.json',analisis); guardar(d/'narrativa.json',narrativa); generar_html(analisis,narrativa,d/'informe.html',origen=origen)
            if args.pdf: generar_pdf(d/'informe.html',d/'informe.pdf',args.navegador)
    except EntradaInvalida as e:
        for error in e.errores: print(error,file=sys.stderr)
        return 2
    except (OSError,ValueError) as e:
        print(f'Error: {e}',file=sys.stderr); return 2
    return 0
if __name__=='__main__': sys.exit(main())
