import { expect } from 'chai';
import { of } from 'rxjs';
import { identity } from './identityOperator';

/** @test {identity} */

describe('identity', () => {
    it('should create an Observable which mirrors the source Observable', () => {
        const data = [1, 2, 3];
        const notifiedValues: number[] = [];
        const source$ = of(...data);

        source$.pipe(identity()).subscribe({
            next: (value) => notifiedValues.push(value),
        });

        expect(notifiedValues.length).equal(data.length);
        notifiedValues.forEach((v, i) => expect(v).equal(data[i]));
    });
});
