import { expect } from 'chai';
import { interval, of, timer, merge, Observable, defer, from } from 'rxjs';
import { delay, finalize, map, mergeMap, mergeMapTo, share, take, toArray } from 'rxjs/operators';
import { TestScheduler } from 'rxjs/testing';
import { bufferConcatMap } from './bufferedConcatMap';
import { observableMatcher } from './test-helpers/observableMatcher';

/** @test {bufferConcatMap} */
describe('bufferConcatMap - same tests as concatMap', () => {
    let testScheduler: TestScheduler;

    beforeEach(() => {
        testScheduler = new TestScheduler(observableMatcher);
    });

    it('should map-and-flatten each item to an Observable', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const e1 = hot('   --1-----3--5-------|');
            const e1subs = '   ^------------------!';
            const e2 = cold('  x-|              ', { x: 10 });
            const expected = ' --x-----y--z-------|';
            const values = { x: [10], y: [30], z: [50] };

            const result = e1.pipe(
                bufferConcatMap((_values) => e2.pipe(map((i) => _values.map((val) => i * parseInt(val))))),
            );

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should map-and-flatten each item to an Observable, but buffering reduces the 3 notifications of source to 2 notifications of result', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const e1 = hot('   --1-----3--5-------|');
            const e1subs = '   ^------------------!';
            const e2 = cold('  x------------|              ', { x: 10 });
            const expected = ' --x------------y------------|';
            const values = { x: [10], y: [30, 50] };

            const result = e1.pipe(
                bufferConcatMap((values) => e2.pipe(map((i) => values.map((val) => i * parseInt(val))))),
            );

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should buffer 2 elements while the first element is processed and notify them together and then notify the next one immediately', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const e1 = hot('   --1-----3--5-------------------7-|');
            const e1subs = '   ^--------------------------------!';
            const e2 = cold('  x------------|              ', { x: 10 });
            const expected = ' --x------------y---------------z------------|';
            const values = { x: [10], y: [30, 50], z: [70] };

            const result = e1.pipe(
                bufferConcatMap((values) => e2.pipe(map((i) => values.map((val) => i * parseInt(val))))),
            );

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    // test cases to check the correct implementation of index and buffereIndex
    it('uses the index parameter to modify the value notified', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const e1 = hot('   --1-----3--5-------------------7-|');
            const e1subs = '   ^--------------------------------!';
            const e2 = cold('  x------------|                    ', { x: 10 });
            const expected = ' --x------------y---------------z------------|';
            // when y is notified source has already notified 1,2,3 hence the index parameter is equal to 2 (2 means the third element notified)
            const values = { x: [10], y: [32, 52], z: [73] };

            const result = e1.pipe(
                bufferConcatMap((values, index) => e2.pipe(map((i) => values.map((val) => i * parseInt(val) + index)))),
            );

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });
    it('uses the bufferIndex parameter to modify the value notified', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const e1 = hot('   --1-----3--5-------------------7-|');
            const e1subs = '   ^--------------------------------!';
            const e2 = cold('  x------------|                    ', { x: 10 });
            const expected = ' --x------------y---------------z------------|';
            // when y is notified it is becauese the second buffer has been passed to the project
            // function of bufferConcatMap hence the bufferIndex parameter is equal to 1 (1 means the second buffer passed down)
            const values = { x: [10], y: [31, 51], z: [72] };

            const result = e1.pipe(
                bufferConcatMap((values, _, bufferIndex) =>
                    e2.pipe(map((i) => values.map((val) => i * parseInt(val) + bufferIndex))),
                ),
            );

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });
    it('uses both index and bufferIndex parameter to modify the value notified', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const e1 = hot('   --1-----3--5-------------------7-|');
            const e1subs = '   ^--------------------------------!';
            const e2 = cold('  x------------|                    ', { x: 10 });
            const expected = ' --x------------y---------------z------------|';
            // when z is notified it is because the third buffer has been passed to the project function
            // of bufferConcatMap hence the bufferIndex parameter is equal to 1 (1 means the second buffer passed down)
            // moreover when z is notified, the source Observale has already notified 1,2,3 hence the _index parameter
            // is equal to 3 (3 means the fourth element notified)
            // therefore we have 70 + 2 + 3 = 75
            const values = { x: [10], y: [33, 53], z: [75] };

            const result = e1.pipe(
                bufferConcatMap((values, index, bufferIndex) =>
                    e2.pipe(map((i) => values.map((val) => i * parseInt(val) + index + bufferIndex))),
                ),
            );

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should handle an empty source', () => {
        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
            const e1 = cold('   |');
            const e1subs = '    (^!)';
            const inner = cold('-1-2-3|');
            const innersubs: string[] = [];
            const expected = '  |';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should handle a never source', () => {
        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
            const e1 = cold('   -');
            const e1subs = '    ^';
            const inner = cold('-1-2-3|');
            const innersubs: string[] = [];
            const expected = '  -';

            const result = e1.pipe(
                bufferConcatMap(() => {
                    return inner;
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should error immediately if given a just-throw source', () => {
        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
            const e1 = cold('   #');
            const e1subs = '    (^!)';
            const inner = cold('-1-2-3|');
            const innersubs: string[] = [];
            const expected = '  #';

            const result = e1.pipe(
                bufferConcatMap(() => {
                    return inner;
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should return a silenced version of the source if the mapped inner is empty', () => {
        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
            const e1 = cold('   --a-b--c-| ');
            const e1subs = '    ^--------! ';
            const inner = cold('  |');
            const innersubs = [
                '                 --(^!)     ',
                '                 ----(^!)   ',
                '                 -------(^!)',
            ];
            const expected = '  ---------| ';

            const result = e1.pipe(
                bufferConcatMap(() => {
                    return inner;
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should return a never if the mapped inner is never', () => {
        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
            const e1 = cold('  --a-b--c-|');
            const e1subs = '   ^--------!';
            const inner = cold(' -');
            const innersubs = '--^-------';
            const expected = ' ----------';

            const result = e1.pipe(
                bufferConcatMap(() => {
                    return inner;
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should propagate errors if the mapped inner is a just-throw Observable', () => {
        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
            const e1 = cold('  --a-b--c-|');
            const e1subs = '   ^-!       ';
            const inner = cold(' #');
            const innersubs = '--(^!)    ';
            const expected = ' --#       ';

            const result = e1.pipe(
                bufferConcatMap(() => {
                    return inner;
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many regular interval inners', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('  --a-a-a-(a|)                            ', { a: ['a'] });
            const asubs = '   ^-------!                               ';
            const b = cold('          ----b--b--(b|)                  ', { b: ['b'] });
            const bsubs = '   --------^---------!                     ';
            const c = cold('                           -c-c-(c|)      ', { c: ['c'] });
            const csubs = '   -------------------------^----!         ';
            const d = cold('                                ------(d|)', { d: ['d'] });
            const dsubs = '   ------------------------------^-----!   ';
            const e1 = hot('  a---b--------------------c-d----|       ');
            const e1subs = '  ^-------------------------------!       ';
            const expected = '--a-a-a-a---b--b--b-------c-c-c-----(d|)';
            const values = { a: ['a'], b: ['b'], c: ['c'], d: ['d'] };

            const observableLookup = { a: a, b: b, c: c, d: d };
            const source = e1.pipe(
                bufferConcatMap((value) => observableLookup[value[0] as keyof typeof observableLookup]),
            );

            expectObservable(source).toBe(expected, values);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer values to many inner values, with 2 outer values (b and c) buffered', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('    -a---b---c---d---|                        ');
            const e1subs = '    ^----------------!                        ';
            const inner = cold(' --i-j-k-l-|                              ', values);
            const innersubs = [
                '                 -^---------!                              ',
                '                 -----------^---------!                    ',
                '                 ---------------------^---------!          ',
            ];
            const expected = '   ---i-j-k-l---i-j-k-l---i-j-k-l-|';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer to many inner, complete late, with 2 outer values (b and c) buffered', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('    -a---b---c---d----------------------------------|');
            const e1subs = '    ^-----------------------------------------------!';
            const inner = cold(' --i-j-k-l-|                                     ', values);
            const innersubs = [
                '                 -^---------!                                     ',
                '                 -----------^---------!                           ',
                '                 ---------------------^---------!                 ',
            ];
            const expected = '  ---i-j-k-l---i-j-k-l---i-j-k-l------------------|';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer to many inner, outer never completes, with 2 outer values (b and c) buffered', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('    -a---b---c---d-----------------------------------');
            const e1subs = '    ^------------------------------------------------';
            const inner = cold(' --i-j-k-l-|                                     ', values);
            const innersubs = [
                '                 -^---------!                                     ',
                '                 -----------^---------!                           ',
                '                 ---------------------^---------!                 ',
            ];
            const expected = '  ---i-j-k-l---i-j-k-l---i-j-k-l-------------------';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer to many inner, inner never completes', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('    -a---b---c---d---|');
            const e1subs = '    ^----------------!';
            const inner = cold(' --i-j-k-l-       ', values);
            const innersubs = ' -^----------------';
            const expected = '  ---i-j-k-l--------';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer to many inner, and inner throws', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('    -a---b---c---d---|');
            const e1subs = '    ^----------!      ';
            const inner = cold(' --i-j-k-l-#      ', values);
            const innersubs = ' -^---------!      ';
            const expected = '  ---i-j-k-l-#      ';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer to many inner, with 2 outer values (b and c) buffered, and outer throws', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('     -a---b---c---d---#');
            const e1subs = '     ^----------------!';
            const inner = cold('  --i-j-k-l-|      ', values);
            const innersubs = [' -^---------!     ', ' -----------^-----!'];
            const expected = '   ---i-j-k-l---i-j-#';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many outer to many inner, both inner and outer throw', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const values = { i: 'foo', j: 'bar', k: 'baz', l: 'qux' };
            const e1 = hot('    -a---b---c---d---#');
            const e1subs = '    ^----------!      ';
            const inner = cold(' --i-j-k-l-#      ', values);
            const innersubs = ' -^---------!      ';
            const expected = '  ---i-j-k-l-#      ';

            const result = e1.pipe(bufferConcatMap(() => inner));

            expectObservable(result).toBe(expected, values);
            expectSubscriptions(inner.subscriptions).toBe(innersubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, where all inners are finite, outer is subscribed after it has notified some values', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs = '         -------------------^-------!                           ';
            const f = cold('                                        --|                    ');
            const fsubs = '         --------------------------------^-!                    ';
            const g = cold('                                              ---1-2|          ');
            const gsubs = '         --------------------------------------^-----!          ';
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g|               ');
            const e1subs = '        ^--------------------------------------!               ';
            const expected = '      ---2--3--4--5----6-----2--3--------------1-2|';
            const observableLookup = { a: a, b: b, c: c, d: d, f: f, g: g };

            const result = e1.pipe(
                bufferConcatMap((value) => observableLookup[value[0] as keyof typeof observableLookup]),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, all inners finite except one', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            // since the d Observable never completes, all other Observables are never concatenated
            const d = cold('                           ----2--3-                           ');
            const dsubs = '         -------------------^-----------------------------------';
            const e = cold('                                   -1------2--3-4-5---|        ');
            const esubs: string[] = [];
            const f = cold('                                                      --|      ');
            const fsubs: string[] = [];
            const g = cold('                                                        ---1-2|');
            const gsubs: string[] = [];
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g|               ');
            const e1subs = '        ^--------------------------------------!               ';
            const expected = '      ---2--3--4--5----6-----2--3----------------------------';
            const observableLookup = { a: a, b: b, c: c, d: d, e: e, f: f, g: g };

            const result = e1.pipe(
                bufferConcatMap((value) => observableLookup[value[0] as keyof typeof observableLookup]),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(e.subscriptions).toBe(esubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, inners finite, outer does not complete', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs = '         -------------------^-------!                           ';
            const e = cold('                                   -1------2--3-4-5---|        ');
            const f = cold('                                        --|                    ');
            const fsubs = '         --------------------------------^-!                    ';
            const g = cold('                                              ---1-2|          ');
            const gsubs = '         --------------------------------------^-----!          ';
            // d and e are notified while c is still processing, so d and e are buffered ([d, e])
            // since the function passed to bufferConcatMap takes just the first value of the array
            // paseed as input parameter, only the Observable corresponding to d is executed and the
            // one corresponding to e is ignored
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g---             ');
            const e1subs = '        ^                                                      ';
            const expected = '      ---2--3--4--5----6-----2--3--------------1-2-----------';
            const observableLookup = { a: a, b: b, c: c, d: d, e: e, f: f, g: g };

            const result = e1.pipe(
                bufferConcatMap((value) => {
                    return observableLookup[value[0] as keyof typeof observableLookup];
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, all inners finite, and outer throws', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs = '         -------------------^-------!                           ';
            const e = cold('                                   -1------2--3-4-5---|        ');
            const f = cold('                                        --|                    ');
            const fsubs = '         --------------------------------^-!                    ';
            const g = cold('                                              ---1-2|          ');
            const gsubs = '         --------------------------------------^!               ';
            // d and e are notified while c is still processing, so d and e are buffered ([d, e])
            // since the function passed to bufferConcatMap takes just the first value of the array
            // paseed as input parameter, only the Observable corresponding to d is executed and the
            // one corresponding to e is ignored
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g#               ');
            const e1subs = '        ^--------------------------------------!               ';
            const expected = '      ---2--3--4--5----6-----2--3------------#               ';
            const observableLookup = { a: a, b: b, c: c, d: d, e: e, f: f, g: g };

            const result = e1.pipe(
                bufferConcatMap((value) => observableLookup[value[0] as keyof typeof observableLookup]),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, all inners complete except one throws', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-#                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs: string[] = [];
            const e = cold('                                   -1------2--3-4-5---|        ');
            const esubs: string[] = [];
            const f = cold('                                                      --|      ');
            const fsubs: string[] = [];
            const g = cold('                                                        ---1-2|');
            const gsubs: string[] = [];
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g|               ');
            const e1subs = '        ^------------------!                                   ';
            const expected = '      ---2--3--4--5----6-#                                   ';
            const observableLookup = { a: a, b: b, c: c, d: d, e: e, f: f, g: g };

            const result = e1.pipe(
                bufferConcatMap((value) => observableLookup[value[0] as keyof typeof observableLookup]),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(e.subscriptions).toBe(esubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, all inners finite, outer is unsubscribed early', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs = '         -------------------^-------!                           ';
            const e = cold('                                   -1------2--3-4-5---|        ');
            const f = cold('                                                      --|      ');
            const fsubs: string[] = [];
            const g = cold('                                                        ---1-2|');
            const gsubs: string[] = [];
            // d and e are notified while c is still processing, so d and e are buffered ([d, e])
            // since the function passed to bufferConcatMap takes just the first value of the array
            // paseed as input parameter, only the Observable corresponding to d is executed and the
            // one corresponding to e is ignored
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g|               ');
            const e1subs = '        ^-----------------------------!                        ';
            const unsub = '         ^-----------------------------!                        ';
            const expected = '      ---2--3--4--5----6-----2--3----                        ';
            const observableLookup: Record<string, Observable<string>> = {
                a: a,
                b: b,
                c: c,
                d: d,
                e: e,
                f: f,
                g: g,
            };

            const result = e1.pipe(bufferConcatMap((value) => observableLookup[value[0]]));

            expectObservable(result, unsub).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should not break unsubscription chains when result is unsubscribed explicitly', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('   -#                                                          ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs = '         -------------------^-------!                           ';
            const e = cold('                                   -1------2--3-4-5---|        ');
            const esubs: string[] = [];
            const f = cold('                                                      --|      ');
            const fsubs: string[] = [];
            const g = cold('                                                        ---1-2|');
            const gsubs: string[] = [];
            // d and e are notified while c is still processing, so d and e are buffered ([d, e])
            // since the function passed to bufferConcatMap takes just the first value of the array
            // paseed as input parameter, only the Observable corresponding to d is executed and the
            // one corresponding to e is ignored
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g|               ');
            const e1subs = '        ^-----------------------------!                        ';
            const unsub = '         ^-----------------------------!                        ';
            const expected = '      ---2--3--4--5----6-----2--3----                        ';
            const observableLookup: Record<string, Observable<string>> = {
                a: a,
                b: b,
                c: c,
                d: d,
                e: e,
                f: f,
                g: g,
            };

            const result = e1.pipe(
                mergeMap((x) => of(x)),
                bufferConcatMap((value) => observableLookup[value[0]]),
                mergeMap((x) => of(x)),
            );

            expectObservable(result, unsub).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(e.subscriptions).toBe(esubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should concatenate many complex, all inners finite, project throws', () => {
        testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
            const a = cold('   -#                                                          ');
            const asubs: string[] = [];
            const b = cold('     -#                                                        ');
            const bsubs: string[] = [];
            const c = cold('          -2--3--4--5----6-|                                   ');
            const csubs = '         --^----------------!                                   ';
            const d = cold('                           ----2--3|                           ');
            const dsubs: string[] = [];
            const e = cold('                                   -1------2--3-4-5---|        ');
            const esubs: string[] = [];
            const f = cold('                                                      --|      ');
            const fsubs: string[] = [];
            const g = cold('                                                        ---1-2|');
            const gsubs: string[] = [];
            const e1 = hot('  -a-b--^-c-----d------e----------------f-----g|               ');
            const e1subs = '        ^------------------!                           ';
            const expected = '      ---2--3--4--5----6-#                           ';
            const observableLookup: Record<string, Observable<string>> = {
                a: a,
                b: b,
                c: c,
                d: d,
                e: e,
                f: f,
                g: g,
            };

            const result = e1.pipe(
                bufferConcatMap((value) => {
                    if (value[0] === 'd') {
                        throw 'error';
                    }
                    return observableLookup[value[0]];
                }),
            );

            expectObservable(result).toBe(expected);
            expectSubscriptions(a.subscriptions).toBe(asubs);
            expectSubscriptions(b.subscriptions).toBe(bsubs);
            expectSubscriptions(c.subscriptions).toBe(csubs);
            expectSubscriptions(d.subscriptions).toBe(dsubs);
            expectSubscriptions(e.subscriptions).toBe(esubs);
            expectSubscriptions(f.subscriptions).toBe(fsubs);
            expectSubscriptions(g.subscriptions).toBe(gsubs);
            expectSubscriptions(e1.subscriptions).toBe(e1subs);
        });
    });

    it('should finalize before moving to the next observable', () => {
        const results: any[] = [];

        const create = (n: number) =>
            defer(() => {
                results.push(`init ${n}`);
                return of(`next ${n}`).pipe(
                    delay(100, testScheduler),
                    finalize(() => {
                        results.push(`finalized ${n}`);
                    }),
                );
            });

        // the element 3 is ignored since 2 and 3 are buffered ([2,3]) and we pass to the create function
        // only the first value in the buffer, i.e. 2
        of(1, 2, 3)
            .pipe(bufferConcatMap((ns) => create(ns[0])))
            .subscribe({
                next: (value) => results.push(value),
            });

        testScheduler.flush();

        expect(results).to.deep.equal(['init 1', 'next 1', 'finalized 1', 'init 2', 'next 2', 'finalized 2']);
    });

    //
    // bufferConcatMap does expect a function that returns and Observable and not a function that returns an array
    // (which is an ObservableLike) and therefore the tests where the project function returns an Array are commented out
    //
    // function arrayRepeat(value: string, times: number) {
    //     let results = [];
    //     for (let i = 0; i < times; i++) {
    //         results.push(value);
    //     }
    //     return results;
    // }

    // it('should concatenate many outer to an array for each value', () => {
    //     testScheduler.run(({ hot, expectObservable, expectSubscriptions }) => {
    //         const e1 = hot('  2-----4--------3--------2-------|');
    //         const e1subs = '  ^-------------------------------!';
    //         const expected = '(22)--(4444)---(333)----(22)----|';

    //         const result = e1.pipe(bufferConcatMap((value) => arrayRepeat(value[0], +value[0])));

    //         expectObservable(result).toBe(expected);
    //         expectSubscriptions(e1.subscriptions).toBe(e1subs);
    //     });
    // });

    // it('should concatMap many outer to inner arrays, outer unsubscribed early', () => {
    //     testScheduler.run(({ hot, expectObservable, expectSubscriptions }) => {
    //         const e1 = hot('  2-----4--------3--------2-------|');
    //         const e1subs = '  ^------------!                   ';
    //         const unsub = '   ^------------!                   ';
    //         const expected = '(22)--(4444)--                   ';

    //         const result = e1.pipe(bufferConcatMap((value) => arrayRepeat(value, +value)));

    //         expectObservable(result, unsub).toBe(expected);
    //         expectSubscriptions(e1.subscriptions).toBe(e1subs);
    //     });
    // });

    // it('should concatMap many outer to inner arrays, project throws', () => {
    //     testScheduler.run(({ hot, cold, expectObservable, expectSubscriptions }) => {
    //         const e1 = hot('  2-----4--------3--------2-------|');
    //         const e1subs = '  ^--------------!                 ';
    //         const expected = '(22)--(4444)---#                 ';

    //         let invoked = 0;
    //         const result = e1.pipe(
    //             concatMap((value) => {
    //                 invoked++;
    //                 if (invoked === 3) {
    //                     throw 'error';
    //                 }
    //                 return arrayRepeat(value, +value);
    //             }),
    //         );

    //         expectObservable(result).toBe(expected);
    //         expectSubscriptions(e1.subscriptions).toBe(e1subs);
    //     });
    // });

    it('should map values to constant resolved promises and concatenate', (done) => {
        const source = from([4, 3, 2, 1]);
        const notifications: number[][] = [];
        // from notifies synchroously, but the a Promise is always resolved in a subsequent JS VM loop.
        // therefore, in this case, we have that while the Promise is resolving the value 4, the other values get
        // notified by upstream and therefore buffered by bufferConcatMap
        const project = (val: number[]) => {
            notifications.push(val);
            return from(Promise.resolve(42));
        };

        const results: number[] = [];
        source.pipe(bufferConcatMap(project)).subscribe({
            next: (x) => {
                results.push(x);
            },
            error: () => {
                done(new Error('Subscriber error handler not supposed to be called.'));
            },
            complete: () => {
                expect(notifications).to.deep.equal([[4], [3, 2, 1]]);
                // there are just 2 notifications coming from bufferConcatMap
                expect(results).to.deep.equal([42, 42]);
                done();
            },
        });
    });

    it('should map values to constant rejected promises and concatenate', (done) => {
        const source = from([4, 3, 2, 1]);
        const project = () => from(Promise.reject(42));

        source.pipe(bufferConcatMap(project)).subscribe({
            next: () => {
                done(new Error('Subscriber next handler not supposed to be called.'));
            },
            error: (err) => {
                expect(err).to.deep.equal(42);
                done();
            },
            complete: () => {
                done(new Error('Subscriber complete handler not supposed to be called.'));
            },
        });
    });

    it('should map values to resolved promises and concatenate', (done) => {
        const source = from([4, 3, 2, 1]);
        const project = (value: number[], index: number, bufferIndex: number) =>
            from(Promise.resolve(value[0] + index + bufferIndex));

        const results: number[] = [];
        source.pipe(bufferConcatMap(project)).subscribe({
            next: (x) => {
                results.push(x);
            },
            error: () => {
                done(new Error('Subscriber error handler not supposed to be called.'));
            },
            complete: () => {
                expect(results).to.deep.equal([4, 7]);
                done();
            },
        });
    });

    it('should map values to rejected promises and concatenate', (done) => {
        const source = from([4, 3, 2, 1]);
        const project = (value: number[], index: number, bufferIndex: number) =>
            from(Promise.reject('' + value + '-' + index + '-' + bufferIndex));

        source.pipe(bufferConcatMap(project)).subscribe({
            next: () => {
                done(new Error('Subscriber next handler not supposed to be called.'));
            },
            error: (err) => {
                expect(err).to.deep.equal('4-0-0');
                done();
            },
            complete: () => {
                done(new Error('Subscriber complete handler not supposed to be called.'));
            },
        });
    });

    it('should stop listening to a synchronous observable when unsubscribed', () => {
        const sideEffects: number[] = [];
        const synchronousObservable = new Observable((subscriber) => {
            // This will check to see if the subscriber was closed on each loop
            // when the unsubscribe hits (from the `take`), it should be closed
            for (let i = 0; !subscriber.closed && i < 10; i++) {
                sideEffects.push(i);
                subscriber.next(i);
            }
        });

        synchronousObservable
            .pipe(
                bufferConcatMap((value) => of(value)),
                take(3),
            )
            .subscribe(() => {
                /* noop */
            });

        expect(sideEffects).to.deep.equal([0, 1, 2]);
    });
});

describe(`bufferConcatMap - test from stackoverflow question 
https://stackoverflow.com/questions/70851715/rxjs-how-to-get-all-values-that-are-buffered-during-a-concatmap/70903577?noredirect=1#comment125435996_70903577
`, () => {
    it(`buffers some values since the processing of the values takes longer than the interval between notifications from the source

    setOne$      0----1----2----3----4|
    setTwo$                                                             0----1----2|
    
    source$      0----1----2----3----4----------------------------------0----1----2|
    bufferConcatMap(([i, j, ...]) => --------------([i*2, j*2, ...]))
    
                 -----------------a--------------b--------------c---------------------d--------------e|
                               a=[0]        b=[2,4,6]        c=[8]                 d=[0]         e=[2,4]
    
    `, (done) => {
        const intervalBetweenNotifications = 500;
        const processingTime = 1600;
        const setOne$ = interval(intervalBetweenNotifications).pipe(share(), take(5));
        const setTwo$ = timer(10000).pipe(mergeMapTo(interval(intervalBetweenNotifications).pipe(share(), take(3))));
        const source$ = merge(setOne$, setTwo$).pipe(share());

        function process(val: number[]) {
            return of(val).pipe(
                delay(processingTime),
                map((val) => val.map((i) => i * 2)),
            );
        }

        const expectedValues = [[0], [2, 4, 6], [8], [0], [2, 4]];

        source$.pipe(bufferConcatMap(process), toArray()).subscribe({
            next: (valuesNotified) => {
                expectedValues.forEach((expVal, i) => {
                    expVal.forEach((v, j) => expect(v).equal(valuesNotified[i][j]));
                });
            },
            error: (err) => done(err),
            complete: () => done(),
        });
    }).timeout(20000);
});

describe(`bufferConcatMap - more subscriptions in parallel`, () => {
    it(`buffers some values since the processing of the values takes longer than the interval between notifications from the source

    source$      0----1----2----3----4|
    bufferConcatMap(([i, j, ...], index) => --------------([i*2*index, j*2*index, ...]))
    
                 -----------------a--------------b--------------c---------------------d--------------e|
                               a=[0]        b=[2,4,6]        c=[8]                 d=[0]         e=[2,4]
    
    `, (done) => {
        const intervalBetweenNotifications = 500;
        const processingTime = 1600;
        const source = interval(intervalBetweenNotifications).pipe(take(10));

        function process(val: number[], index: number, buffindex: number) {
            return of(val).pipe(
                delay(processingTime),
                map((val) => val.map((i) => `${i * 2}--${index}--${buffindex}`)),
            );
        }

        const obs = source.pipe(bufferConcatMap((val, i, bi) => process(val, i, bi)));

        let buffers_1: string[][] = [];
        let buffers_2: string[][] = [];

        obs.subscribe({
            next: (v) => {
                // console.log(`!! = ${v}`);
                buffers_1.push(v);
            },
            complete: () => {
                // console.log('Done 1');
            },
        });

        setTimeout(() => {
            obs.subscribe({
                next: (v) => {
                    // console.log(`xx = ${v}`);
                    buffers_2.push(v);
                },
                complete: () => {
                    // console.log('Done 2');
                    buffers_1.forEach((v1, i) => {
                        const v2 = buffers_2[i];
                        v1.forEach((v1_1, j) => {
                            expect(v1_1).equal(v2[j]);
                        });
                    });
                    done();
                },
            });
        }, 2200);
    }).timeout(20000);
});
