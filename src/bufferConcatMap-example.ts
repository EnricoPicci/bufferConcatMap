// example of how to use bufferConcatMap

import { delay, interval, of, take } from 'rxjs';
import { bufferConcatMap } from './bufferedConcatMap';

// source Obaservable
const source = interval(100).pipe(take(5));

// new transformed Observable created with bufferConcatMap
const newTransformedObs = source.pipe(bufferConcatMap((n) => of(n).pipe(delay(1000))));
// which is equivalent to the following 2 lines of code
// const project: (n: any) => Observable<any> = (n: number) => of(n).pipe(delay(1000))
// const newTransformedObs = source.pipe(bufferConcatMap(project))

// subscribe the new Observable
newTransformedObs.subscribe(console.log);
