// at least C++11
#include <fstream>
#include <vector>
#include <string>
#include <type_traits>
#include <iostream>

using namespace std;
const int eps = 1e-6;

ofstream fout, fstd;

template<class T> inline T read() {
    T pans, jans;
    fread(&pans, sizeof(T), 1, fstd);
    if(fread(&jans, sizeof(T), 1, fout) != sizeof(T))
        cerr << "The output file is too short\n", exit(1);
    if(std::is_floating_point<T>::value ?
        abs(pans - jans) > eps * max({pans, jans, (T)1}) : pans != jans
    ) cerr << "expected " << jans << " but found " << pans << '\n';
    return jans;
}
template<class T> void diffData(int cnt) {
    if(cnt == 0) read<T>();
    else {
        size_t size = read<size_t>();
        while(size--) diffData<T>(cnt - 1);
    }
}
int main(int argc, const char* argv[]) {
    if(argc < 3) exit(-1);
    fout.open(argv[1], ios::binary);
    fstd.open(argv[2], ios::binary);
    if(!fout.is_open() || !fstd.is_open()) exit(-1);
    
}