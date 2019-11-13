import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';
import { terser } from "rollup-plugin-terser";
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import sourceMaps from 'rollup-plugin-sourcemaps';
import scss from 'rollup-plugin-scss';
import copy from 'rollup-plugin-copy';

export default {
    input: 'src/celled.ts',
    output: [
        { file: 'dist/celled.js', format: 'umd', name: 'CellEd', sourcemap: true },
        { file: 'dist/celled.min.js', format: 'umd', name: 'CellEd', sourcemap: true },
        { file: pkg.module, format: 'es', sourcemap: true },
    ],
    external: [
        ...Object.keys(pkg.peerDependencies || {})
    ],
    watch: {
        include: 'src/**'
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({ 
            useTsconfigDeclarationDir: true,
            objectHashIgnoreUnknownHack: true,
        }),
        scss(),
        terser({
            include: [/^.+\.min\.js$/],
        }),
        sourceMaps(),
        copy({
            targets: [
              { src: 'src/index.html', dest: 'dist' },
            ],
        })
    ]
};