#include <cstdio>
#include <fstream>
#include <vector>
#include <utility>
#include <string>
#include <type_traits>
#include <cstring>

using namespace std;
const size_t ss = sizeof(size_t);

struct buffer {
    char *data, *now, *end;
    inline buffer() { data = now = new char[128], end = data + 128; }
    inline void add(size_t n) {
        now += n;
        if(now >= end) [[unlikely]] {
            size_t size = now - data, cap = end - data;
            do cap <<= 1; while(cap < size);
            char *newData = new char[cap];
            memcpy(newData, data, size);
            data = newData, now = data + size, end = data + cap;
        }
    }
    template<class T> inline void push(const string& s) {
        if(is_same<T, string>::value) {
            add(ss), *(size_t*)(now - ss) = s.size();
            add(s.size()), memcpy(now - s.size(), s.data(), s.size());
        } else {
            add(sizeof(T));
            T res;
            if(is_same<T, int>::value) res = stoi(s);
            if(is_same<T, long long>::value) res = stoll(s);
            if(is_same<T, double>::value) res = stod(s);
            *(T*)(now - sizeof(T)) = res;
        }
    }
};
template<class T> bool readData(int cnt, ifstream& fin, buffer& buf) {
    if(cnt == 0) {
        if(is_same<T, string>::value) {
            string s;
            char c;
            while(c = fin.get(), c != '\"') if(c == '}') return false;
            while(c = fin.get(), c != '\"') s += c;
            buf.push<T>(s);
            return true;
        } else {
            string s;
            loop:;
            try{
                fin >> s;
                if(s == "}") return false;
                buf.push<T>(s);
            }catch(...){
                goto loop;
            }
            return true;
        }
    } else {
        size_t size = 0, idx = buf.now - buf.data;
        buf.add(ss);
        while(fin.get() != '{');
        while(readData<T>(cnt - 1, fin, buf)) size++;
        *(size_t*)(buf.data + idx) = size;
        return true;
    }
}
void readData(const string& type, int cnt, ifstream& fin, buffer& buf) {
    if(type == "int") readData<int>(cnt, fin, buf);
    if(type == "long") readData<long long>(cnt, fin, buf);
    if(type == "double") readData<double>(cnt, fin, buf);
    if(type == "String") readData<string>(cnt, fin, buf);
}
int main(int argc, const char* argv[]) {
    string path = argc == 1 ? "." : argv[1];
    path += '/';
    ifstream fin(path + "/temp");
    vector<pair<string, int>> Parameters;
    pair<string, int> Returns;

    int pcnt, cnt;
    string type;
    fin >> pcnt;
    while(pcnt--) fin >> type >> cnt, Parameters.emplace_back(type, cnt);
    fin >> Returns.first >> Returns.second;

    int tcnt;
    fin >> tcnt;
    for(int k = 1; k <= tcnt; k++) {
        buffer in, out;
        for(auto&& i : Parameters) readData(i.first, i.second, fin, in);
        readData(Returns.first, Returns.second, fin, out);
        string name = path + "data/" + to_string(k);
        ofstream(name + ".in", ios::binary).write(in.data, in.now - in.data);
        ofstream(name + ".out", ios::binary).write(out.data, out.now - out.data);
    }

    return 0;
}