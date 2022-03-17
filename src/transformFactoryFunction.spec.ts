import { expect } from 'chai';
import { of } from 'rxjs';
import { transformFactoryFunction } from './transformFactoryFunction';

/** @test {transformFactoryFunction} */

describe('transformFactoryFunction', () => {
    it('should create an Observable which notifies each time the source Observable with some transformed values', () => {
        const data = [1, 2, 3];
        const notifiedValues: [number, number][] = [];
        const source$ = of(...data);

        const transformFunction = (val: number, i: number) => {
            return [val * 2, i] as [number, number];
        };
        source$.pipe(transformFactoryFunction(transformFunction)).subscribe({
            next: (value) => notifiedValues.push(value),
        });

        expect(notifiedValues.length).equal(data.length);
        notifiedValues.forEach((v, i) => {
            expect(v[0]).equal(data[i] * 2);
            expect(v[1]).equal(i);
        });
    });
});
